"""
Exotel telephony service.

Manages outbound call initiation, webhook handling, and SMS dispatch
via the Exotel API.  All I/O is async (httpx).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

from backend.config import settings
from backend.schemas.models import DonorNode

logger = logging.getLogger(__name__)

# Reuse a single async client across calls for connection pooling.
_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    """Lazily initialise the shared httpx client."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=f"https://{settings.exotel_subdomain}.exotel.com",
            auth=(settings.exotel_api_key, settings.exotel_api_token),
            timeout=30.0,
        )
    return _client


async def initiate_call(
    donor: DonorNode,
    dispatch_id: str,
    callback_url: str,
) -> Dict[str, Any]:
    """
    Place a single outbound call to `donor.phone` via Exotel.

    Parameters
    ----------
    donor : DonorNode
        The donor to call.
    dispatch_id : str
        Correlation ID so the webhook can tie the call back to a dispatch.
    callback_url : str
        The public URL Exotel should POST status updates to.

    Returns
    -------
    dict   Exotel's API response body (call SID, status, etc.).
    """
    client = await _get_client()
    payload = {
        "From": donor.phone,
        "CallerId": settings.exotel_caller_id,
        "CallType": "trans",
        "StatusCallback": callback_url,
        "StatusCallbackEvents": ["terminal", "answered"],
        "CustomField": dispatch_id,
    }

    try:
        resp = await client.post(
            f"/v1/Accounts/{settings.exotel_sid}/Calls/connect.json",
            data=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        logger.info("Call initiated to %s — SID %s", donor.phone, data.get("Call", {}).get("Sid"))
        return data
    except httpx.HTTPStatusError as exc:
        logger.error("Exotel API error for %s: %s", donor.phone, exc.response.text)
        raise
    except httpx.RequestError as exc:
        logger.error("Network error calling %s: %s", donor.phone, exc)
        raise


async def initiate_bulk_calls(
    donors: List[DonorNode],
    dispatch_id: str,
    callback_url: str,
) -> List[Dict[str, Any]]:
    """
    Fire concurrent outbound calls to every donor in the list.
    Returns a list of Exotel response dicts (one per donor).
    """
    import asyncio

    tasks = [
        initiate_call(donor, dispatch_id, callback_url)
        for donor in donors
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    successes: List[Dict[str, Any]] = []
    for donor, result in zip(donors, results):
        if isinstance(result, Exception):
            logger.error("Failed to call donor %s: %s", donor.id, result)
        else:
            successes.append(result)
    return successes


async def send_sms(phone: str, message: str) -> Dict[str, Any]:
    """
    Send a transactional SMS to `phone` via Exotel (fallback path
    for donors without the mobile app).
    """
    client = await _get_client()
    payload = {
        "From": settings.exotel_caller_id,
        "To": phone,
        "Body": message,
    }

    try:
        resp = await client.post(
            f"/v1/Accounts/{settings.exotel_sid}/Sms/send.json",
            data=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        logger.info("SMS sent to %s", phone)
        return data
    except httpx.HTTPStatusError as exc:
        logger.error("Exotel SMS error for %s: %s", phone, exc.response.text)
        raise


async def close() -> None:
    """Gracefully close the httpx client (call on app shutdown)."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None
