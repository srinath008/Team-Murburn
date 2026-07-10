"""
REST API routes for the AI Blood Dispatch Network.

All endpoints are mounted under ``/api``.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from backend.api.websockets import manager
from backend.db_services import find_eligible_donors, update_donation_date
from backend.orchestration.graph import DispatchState, dispatch_graph
from backend.schemas.models import (
    CallStatus,
    DispatchRequest,
    DispatchResponse,
    DonationLog,
    DonorStatusUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["dispatch"])


# ── POST /api/dispatch ────────────────────────────────────────────

@router.post("/dispatch", response_model=DispatchResponse)
async def trigger_dispatch(
    payload: DispatchRequest,
    background_tasks: BackgroundTasks,
):
    """
    Emergency dispatch trigger.

    1. Queries Neo4j for eligible donors (blood group + 10 km radius + 56-day cooldown).
    2. Kicks off the LangGraph orchestration pipeline in the background.
    3. Returns immediately with a dispatch ID and donor count.
    """
    dispatch_id = str(uuid4())

    # Step 1 — find eligible donors
    donors = await find_eligible_donors(
        blood_group=payload.blood_group,
        lat=payload.coordinates.lat,
        lng=payload.coordinates.lng,
    )

    if not donors:
        return DispatchResponse(
            dispatch_id=dispatch_id,
            donors_matched=0,
            message="No eligible donors found within 10 km. Consider expanding search radius.",
        )

    # Step 2 — prepare initial state for LangGraph
    initial_state: dict = DispatchState(
        dispatch_id=dispatch_id,
        hospital_id=payload.hospital_id,
        blood_group=payload.blood_group,
        urgency=payload.urgency.value,
        lat=payload.coordinates.lat,
        lng=payload.coordinates.lng,
    ).model_dump()

    # Step 3 — run orchestration in the background so we return fast
    background_tasks.add_task(_run_dispatch_graph, dispatch_id, initial_state)

    logger.info(
        "Dispatch %s created — %d donors matched (hospital=%s, blood=%s)",
        dispatch_id,
        len(donors),
        payload.hospital_id,
        payload.blood_group,
    )

    return DispatchResponse(
        dispatch_id=dispatch_id,
        donors_matched=len(donors),
        message="Dispatch initiated. Connect to /ws/dashboard for live updates.",
    )


async def _run_dispatch_graph(dispatch_id: str, initial_state: dict) -> None:
    """
    Execute the LangGraph dispatch pipeline and broadcast updates
    over WebSocket as the graph progresses.
    """
    try:
        result = await dispatch_graph.ainvoke(initial_state)

        # Broadcast any updates the graph produced.
        for update in result.get("updates", []):
            ws_update = DonorStatusUpdate(**update)
            await manager.broadcast(dispatch_id, ws_update)

        logger.info("Dispatch %s graph completed", dispatch_id)

    except Exception as exc:
        logger.exception("Dispatch %s graph failed: %s", dispatch_id, exc)
        # Notify connected dashboards of the failure.
        await manager.broadcast_raw(dispatch_id, {
            "type": "error",
            "dispatch_id": dispatch_id,
            "message": str(exc),
        })


# ── POST /api/donate — Log a Successful Donation ─────────────────

@router.post("/donate")
async def log_donation(payload: DonationLog):
    """
    Called by hospital staff after a successful transfusion.
    Updates the donor's `last_donated_date` in Neo4j, activating
    the 56-day medical cooldown.
    """
    success = await update_donation_date(
        donor_id=payload.donor_id,
        donated_at=datetime.utcnow(),
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update donation record.")

    logger.info("Donation logged for donor %s at hospital %s", payload.donor_id, payload.hospital_id)

    return {
        "status": "ok",
        "donor_id": payload.donor_id,
        "cooldown_until": (datetime.utcnow().replace(microsecond=0)).isoformat() + " + 56 days",
        "message": "Donation recorded. Donor is now on 56-day cooldown.",
    }


# ── GET /api/health ───────────────────────────────────────────────

@router.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "healthy", "service": "blood-dispatch-backend"}
