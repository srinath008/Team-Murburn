"""
REST API routes for the AI Blood Dispatch Network.

All endpoints are mounted under ``/api``.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Depends

from backend.api.websockets import manager
from backend.api.auth import get_current_hospital
from backend.db_services import find_eligible_donors, update_donation_date, register_donor, get_donor_by_phone, delete_donor
from backend.orchestration.graph import DispatchState, dispatch_graph
from backend.schemas.models import (
    CallStatus,
    DispatchRequest,
    DispatchResponse,
    DonationLog,
    DonorStatusUpdate,
    DonorRegistration,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["dispatch"])


# ── POST /api/dispatch ────────────────────────────────────────────

@router.post("/dispatch", response_model=DispatchResponse)
async def trigger_dispatch(
    payload: DispatchRequest,
    background_tasks: BackgroundTasks,
    hospital_id: str = Depends(get_current_hospital)
):
    """
    Emergency dispatch trigger.

    1. Queries Neo4j for eligible donors (blood group + 10 km radius + 56-day cooldown).
    2. Kicks off the LangGraph orchestration pipeline in the background.
    3. Returns immediately with a dispatch ID and donor count.
    """
    dispatch_id = str(uuid4())

    # Geocode if coordinates are missing/zero and address is provided
    lat = payload.coordinates.lat
    lng = payload.coordinates.lng
    if lat == 0.0 and lng == 0.0 and payload.address:
        from backend.services.geocoding import geocode_address
        coords = await geocode_address(payload.address)
        if coords:
            lat, lng = coords

    # Step 1 — find eligible donors
    donors = await find_eligible_donors(
        blood_group=payload.blood_group,
        lat=lat,
        lng=lng,
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
        lat=lat,
        lng=lng,
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
async def log_donation(
    payload: DonationLog,
    hospital_id: str = Depends(get_current_hospital)
):
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


# ── POST /api/donor/register ───────────────────────────────────────

@router.post("/donor/register")
async def register_new_donor(payload: DonorRegistration):
    """
    Called by the mobile app to register a new donor or update an existing one.
    """
    try:
        await register_donor(
            name=payload.name,
            phone=payload.phone,
            blood_group=payload.blood_group,
            language=payload.language.lower(),
            lat=payload.lat,
            lng=payload.lng,
        )
        return {"status": "ok", "message": "Donor successfully registered"}
    except Exception as exc:
        logger.exception("Failed to register donor: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to register donor")


# ── GET /api/donor/profile/{phone} ─────────────────────────────────

@router.get("/donor/profile/{phone}")
async def get_donor_profile(phone: str):
    """
    Called by the mobile app on startup to sync the donor's profile
    and cooldown status from the database.
    """
    try:
        donor = await get_donor_by_phone(phone)
        if not donor:
            raise HTTPException(status_code=404, detail="Donor not found")
            
        return {
            "status": "ok",
            "donor": {
                "id": donor.id,
                "name": donor.name,
                "phone": donor.phone,
                "blood_group": donor.blood_group,
                "last_donated_date": donor.last_donated_date.isoformat() if donor.last_donated_date else None,
            }
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to get donor profile: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to get donor profile")


# ── DELETE /api/donor/profile/{phone} ───────────────────────────────

@router.delete("/donor/profile/{phone}")
async def remove_donor_profile(phone: str):
    """
    Called by the mobile app to delete the donor's profile from the DB.
    """
    try:
        success = await delete_donor(phone)
        if not success:
            raise HTTPException(status_code=404, detail="Donor not found")
            
        return {"status": "ok", "message": "Donor successfully deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to delete donor profile: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to delete donor profile")


# ── GET /api/health ───────────────────────────────────────────────

@router.get("/health")
async def health_check():
    """Advanced liveness and readiness probe."""
    from backend.db_services import _get_driver
    db_status = "unknown"
    try:
        driver = _get_driver()
        async with driver.session() as session:
            await session.run("RETURN 1")
        db_status = "connected"
    except Exception as e:
        db_status = f"disconnected: {str(e)}"
        logger.error("Health check failed to connect to Neo4j: %s", e)

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "blood-dispatch-backend",
        "neo4j": db_status
    }
