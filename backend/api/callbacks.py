"""
Twilio callback and audio-stream endpoints.

Routes:
  POST  /api/twilio/status-callback    — Twilio call-status webhook
  WS    /ws/twilio/audio-stream        — Twilio live audio WebSocket
"""

from __future__ import annotations

import json
import base64
import logging
from typing import Optional

from fastapi import APIRouter, Form, Query, WebSocket, WebSocketDisconnect

from backend.api.websockets import manager
from backend.dispatch_store import dispatch_store
from backend.schemas.models import CallStatus, DonorStatusUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["twilio-callbacks"])


# ── Twilio status → our CallStatus mapping ────────────────────────

_TWILIO_STATUS_MAP = {
    "in-progress": None,           
    "completed":   None,           
    "busy":        CallStatus.DECLINED,
    "no-answer":   CallStatus.DECLINED,
    "failed":      CallStatus.DECLINED,
    "canceled":    CallStatus.DECLINED,
}


# ── GET /api/twilio/twiml ─────────────────────────────────────────

from fastapi.responses import Response
from backend.config import settings

@router.post("/api/twilio/twiml")
@router.get("/api/twilio/twiml")
async def get_twiml(dispatch_id: str = Query(default=""), donor_id: str = Query(default="")):
    """
    Returns the TwiML XML that instructs Twilio to connect the call
    to our Audio Stream WebSocket.
    """
    ws_url = settings.server_base_url.replace("http", "ws") + settings.twilio_audio_ws_path
    
    # We can pass custom params by appending them to the stream URL
    stream_url = f"{ws_url}?dispatch_id={dispatch_id}&donor_id={donor_id}"
    
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{stream_url}" />
    </Connect>
</Response>"""
    return Response(content=xml, media_type="application/xml")


# ── POST /api/twilio/status-callback ─────────────────────────────

@router.post("/api/twilio/status-callback")
async def twilio_status_callback(
    CallSid: str = Form(default=""),
    CallStatus: str = Form(default=""),
    dispatch_id: str = Query(default=""),
    donor_id: str = Query(default=""),
):
    """
    Webhook endpoint that Twilio POSTs to whenever a call's status changes.
    """
    logger.info(
        "Twilio callback: SID=%s Status=%s dispatch_id=%s donor_id=%s",
        CallSid, CallStatus, dispatch_id, donor_id,
    )

    if not dispatch_id or not donor_id:
        logger.warning("Twilio callback missing query params for SID: %s", CallSid)
        return {"status": "ignored", "reason": "missing params"}

    # Map Twilio status to our enum.
    mapped_status: Optional[CallStatus] = _TWILIO_STATUS_MAP.get(
        CallStatus.lower(), CallStatus.DECLINED
    )

    if mapped_status is None:
        logger.debug(
            "Twilio status '%s' for SID %s — no status update emitted",
            CallStatus, CallSid,
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


# ── WebSocket /ws/twilio/audio-stream ─────────────────────────────

@router.websocket("/ws/twilio/audio-stream")
async def twilio_audio_stream(
    websocket: WebSocket,
    dispatch_id: str = Query(default=""),
    donor_id: str = Query(default=""),
):
    """
    WebSocket endpoint for Twilio to stream live call audio.
    Twilio sends JSON messages with Base64 audio chunks.
    """
    from backend.services.voice_pipeline import active_sessions, VoiceSession

    await websocket.accept()
    logger.info("Audio stream WebSocket connected (dispatch_id=%s, donor_id=%s)", dispatch_id, donor_id)

    if not dispatch_id or not donor_id:
        logger.warning("Audio stream missing query params — closing")
        await websocket.close(code=1008, reason="Missing params")
        return

    # Fetch donor info for language selection.
    donor = await dispatch_store.get_donor(dispatch_id, donor_id)
    language = donor.get("language", "english") if donor else "english"

    # Get dispatch info for the hospital context.
    dispatch = await dispatch_store.get_dispatch(dispatch_id)
    hospital_id = dispatch.get("hospital_id", "") if dispatch else ""
    blood_group = dispatch.get("blood_group", "") if dispatch else ""

    # Create session without CallSid initially (we'll get it from the 'start' event)
    session = VoiceSession(
        call_sid="", 
        dispatch_id=dispatch_id,
        donor_id=donor_id,
        donor_name=donor.get("name", "Donor") if donor else "Donor",
        language=language,
        hospital_id=hospital_id,
        blood_group=blood_group,
    )
    
    stream_sid = ""

    try:
        while True:
            data_str = await websocket.receive_text()
            msg = json.loads(data_str)
            
            if msg["event"] == "start":
                stream_sid = msg["start"]["streamSid"]
                call_sid = msg["start"]["callSid"]
                session.call_sid = call_sid
                active_sessions[call_sid] = session
                logger.info("Twilio stream started. StreamSid: %s, CallSid: %s", stream_sid, call_sid)
                
                # Send the greeting immediately when stream starts
                greeting_audio, _ = await session.handle_audio_chunk(b"")
                if greeting_audio:
                    out_msg = {
                        "event": "media",
                        "streamSid": stream_sid,
                        "media": {"payload": base64.b64encode(greeting_audio).decode("utf-8")}
                    }
                    await websocket.send_text(json.dumps(out_msg))
                    
            elif msg["event"] == "media":
                audio_bytes = base64.b64decode(msg["media"]["payload"])
                
                # Process through the voice pipeline.
                response_audio, intent = await session.handle_audio_chunk(audio_bytes)

                # If the pipeline produced a TTS response, send it back.
                if response_audio:
                    out_msg = {
                        "event": "media",
                        "streamSid": stream_sid,
                        "media": {"payload": base64.b64encode(response_audio).decode("utf-8")}
                    }
                    await websocket.send_text(json.dumps(out_msg))

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
                        out_msg = {
                            "event": "media",
                            "streamSid": stream_sid,
                            "media": {"payload": base64.b64encode(closing_audio).decode("utf-8")}
                        }
                        await websocket.send_text(json.dumps(out_msg))
                        
                    break

            elif msg["event"] == "stop":
                logger.info("Twilio stream stopped for StreamSid: %s", stream_sid)
                break

    except WebSocketDisconnect:
        logger.info("Audio stream disconnected")
    except Exception as exc:
        logger.error("Audio stream error: %s", exc)
    finally:
        # Cleanup the session.
        if session.call_sid:
            active_sessions.pop(session.call_sid, None)
            logger.debug("Voice session cleaned up for call_sid=%s", session.call_sid)


# ── Post-acceptance routing (called from audio stream) ────────────

async def _route_accepted_donor(
    dispatch_id: str,
    donor_id: str,
    donor: Optional[dict],
    dispatch: Optional[dict],
) -> None:
    from backend.db_services import get_donor_push_token
    from backend.services.twilio_service import send_sms
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
