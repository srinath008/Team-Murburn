"""
Exotel callback and audio-stream endpoints.

Routes:
  POST  /api/exotel/status-callback    — Exotel call-status webhook
  WS    /ws/exotel/audio-stream        — Exotel live audio WebSocket
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Form, Query, WebSocket, WebSocketDisconnect

from backend.api.websockets import manager
from backend.dispatch_store import dispatch_store
from backend.schemas.models import CallStatus, DonorStatusUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["exotel-callbacks"])


# ── Exotel status → our CallStatus mapping ────────────────────────

_EXOTEL_STATUS_MAP = {
    "in-progress": None,           # Call is ringing / ongoing — no update yet
    "completed":   None,           # Terminal — resolved by voice pipeline intent
    "busy":        CallStatus.DECLINED,
    "no-answer":   CallStatus.DECLINED,
    "failed":      CallStatus.DECLINED,
    "canceled":    CallStatus.DECLINED,
}


# ── POST /api/exotel/status-callback ─────────────────────────────

@router.post("/api/exotel/status-callback")
async def exotel_status_callback(
    CallSid: str = Form(...),
    Status: str = Form(default=""),
    CustomField: str = Form(default=""),
    To: str = Form(default=""),
    From_: str = Form(default="", alias="From"),
    DateUpdated: str = Form(default=""),
):
    """
    Webhook endpoint that Exotel POSTs to whenever a call's status
    changes (answered, completed, busy, no-answer, failed).

    We look up the dispatch + donor from the call SID, map the Exotel
    status to our internal CallStatus, and broadcast the update to the
    hospital dashboard via WebSocket.
    """
    logger.info(
        "Exotel callback: SID=%s Status=%s CustomField=%s To=%s",
        CallSid, Status, CustomField, To,
    )

    # Look up which dispatch + donor this call belongs to.
    lookup = await dispatch_store.get_by_call_sid(CallSid)
    if not lookup:
        logger.warning("Exotel callback for unknown call SID: %s", CallSid)
        return {"status": "ignored", "reason": "unknown call_sid"}

    dispatch_id, donor_id = lookup

    # Map Exotel status to our enum.
    mapped_status: Optional[CallStatus] = _EXOTEL_STATUS_MAP.get(
        Status.lower(), CallStatus.DECLINED
    )

    if mapped_status is None:
        # Call is in-progress or completed (voice pipeline handles acceptance).
        logger.debug(
            "Exotel status '%s' for SID %s — no status update emitted",
            Status, CallSid,
        )
        return {"status": "ack", "call_sid": CallSid}

    # Update the in-memory store.
    updated = await dispatch_store.update_donor_status(
        dispatch_id, donor_id, mapped_status
    )

    if updated:
        # Fetch the donor info to build the WebSocket payload.
        donor = await dispatch_store.get_donor(dispatch_id, donor_id)
        if donor:
            ws_update = DonorStatusUpdate(
                donor_id=donor_id,
                name=donor.get("name", "Unknown"),
                status=mapped_status,
                eta_minutes=donor.get("eta_minutes"),
            )
            await manager.broadcast(dispatch_id, ws_update)
            logger.info(
                "Broadcast %s for donor %s (dispatch %s)",
                mapped_status.value, donor_id, dispatch_id,
            )

    return {"status": "ok", "call_sid": CallSid, "mapped_status": mapped_status.value}


# ── WebSocket /ws/exotel/audio-stream ─────────────────────────────

@router.websocket("/ws/exotel/audio-stream")
async def exotel_audio_stream(
    websocket: WebSocket,
    call_sid: str = Query(default=""),
):
    """
    WebSocket endpoint for Exotel to stream live call audio.

    Exotel sends raw audio frames; we pipe them through the
    VoiceSession (Sarvam STT → intent → Sarvam TTS) and send
    synthesized audio responses back.

    Query params:
        call_sid — The Exotel call SID for this audio stream.
    """
    from backend.services.voice_pipeline import active_sessions, VoiceSession

    await websocket.accept()
    logger.info("Audio stream WebSocket connected (call_sid=%s)", call_sid)

    # Look up dispatch context.
    lookup = await dispatch_store.get_by_call_sid(call_sid)
    if not lookup:
        logger.warning("Audio stream for unknown call SID: %s — closing", call_sid)
        await websocket.close(code=1008, reason="Unknown call SID")
        return

    dispatch_id, donor_id = lookup

    # Fetch donor info for language selection.
    donor = await dispatch_store.get_donor(dispatch_id, donor_id)
    language = donor.get("language", "english") if donor else "english"

    # Get dispatch info for the hospital context.
    dispatch = await dispatch_store.get_dispatch(dispatch_id)
    hospital_id = dispatch.get("hospital_id", "") if dispatch else ""
    blood_group = dispatch.get("blood_group", "") if dispatch else ""

    # Create or retrieve the voice session.
    session = VoiceSession(
        call_sid=call_sid,
        dispatch_id=dispatch_id,
        donor_id=donor_id,
        donor_name=donor.get("name", "Donor") if donor else "Donor",
        language=language,
        hospital_id=hospital_id,
        blood_group=blood_group,
    )
    active_sessions[call_sid] = session

    try:
        while True:
            # Receive audio chunk from Exotel.
            data = await websocket.receive_bytes()

            # Process through the voice pipeline.
            response_audio, intent = await session.handle_audio_chunk(data)

            # If the pipeline produced a TTS response, send it back.
            if response_audio:
                await websocket.send_bytes(response_audio)

            # If an intent was resolved, update the dispatch state.
            if intent in ("accepted", "declined"):
                new_status = (
                    CallStatus.ACCEPTED if intent == "accepted"
                    else CallStatus.DECLINED
                )
                await dispatch_store.update_donor_status(
                    dispatch_id, donor_id, new_status,
                    eta_minutes=session.eta_minutes,
                )
                # Broadcast to dashboard.
                ws_update = DonorStatusUpdate(
                    donor_id=donor_id,
                    name=session.donor_name,
                    status=new_status,
                    eta_minutes=session.eta_minutes,
                )
                await manager.broadcast(dispatch_id, ws_update)
                logger.info(
                    "Voice intent '%s' for donor %s (dispatch %s)",
                    intent, donor_id, dispatch_id,
                )

                # ── Post-acceptance routing ───────────────────────
                # The LangGraph graph finishes before async calls
                # resolve, so we trigger routing directly here.
                if intent == "accepted":
                    await _route_accepted_donor(
                        dispatch_id=dispatch_id,
                        donor_id=donor_id,
                        donor=donor,
                        dispatch=dispatch,
                    )

                # Deliver a closing message and end the session.
                if intent == "accepted":
                    closing_audio = await session.generate_closing_message(accepted=True)
                else:
                    closing_audio = await session.generate_closing_message(accepted=False)
                if closing_audio:
                    await websocket.send_bytes(closing_audio)
                break

    except WebSocketDisconnect:
        logger.info("Audio stream disconnected (call_sid=%s)", call_sid)
    except Exception as exc:
        logger.error("Audio stream error (call_sid=%s): %s", call_sid, exc)
    finally:
        # Cleanup the session.
        active_sessions.pop(call_sid, None)
        logger.debug("Voice session cleaned up for call_sid=%s", call_sid)


# ── Post-acceptance routing (called from audio stream) ────────────

async def _route_accepted_donor(
    dispatch_id: str,
    donor_id: str,
    donor: Optional[dict],
    dispatch: Optional[dict],
) -> None:
    """
    Trigger post-acceptance routing for a donor who accepted via
    the AI voice call.

    This function runs the same logic as ``route_donor_node`` in
    the LangGraph graph, but is invoked directly from the audio
    stream handler because calls resolve asynchronously after the
    graph has already completed.

    Routes:
      • has_app=True  → Expo push notification with hospital coords
      • has_app=False → SMS with web tracking link
    """
    from backend.db_services import get_donor_push_token
    from backend.services.exotel_service import send_sms
    from backend.services.push_service import send_dispatch_notification

    if not donor or not dispatch:
        logger.warning(
            "Cannot route donor %s — missing context", donor_id
        )
        return

    has_app = donor.get("has_app", False)
    phone = donor.get("phone", "")
    hospital_id = dispatch.get("hospital_id", "")
    blood_group = dispatch.get("blood_group", "")

    if has_app:
        # Native path — Expo push notification.
        try:
            push_token = await get_donor_push_token(donor_id)
            if push_token:
                await send_dispatch_notification(
                    expo_token=push_token,
                    dispatch_id=dispatch_id,
                    hospital_id=hospital_id,
                    blood_group=blood_group,
                    hospital_lat=dispatch.get("lat", 0.0),
                    hospital_lng=dispatch.get("lng", 0.0),
                )
                logger.info("Donor %s routed via push notification", donor_id)
                return
            else:
                logger.warning(
                    "Donor %s has_app=true but no push token — SMS fallback",
                    donor_id,
                )
        except Exception as exc:
            logger.error("Push failed for donor %s: %s — SMS fallback", donor_id, exc)

    # Fallback — SMS with tracking link.
    if phone:
        tracking_url = f"https://bloodnet.app/track/{dispatch_id}/{donor_id}"
        try:
            await send_sms(
                phone=phone,
                message=f"Thank you for accepting! Navigate to the hospital: {tracking_url}",
            )
            logger.info("Donor %s routed via SMS tracking link", donor_id)
        except Exception as exc:
            logger.error("SMS failed for donor %s: %s", donor_id, exc)
    else:
        logger.error("Donor %s has no phone number — cannot route", donor_id)
