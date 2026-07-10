"""
Pydantic models that enforce the strict JSON data-contracts
defined in the System Architecture Manifest.

Every payload flowing between frontend ↔ backend ↔ telephony
MUST be validated through one of these schemas.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────

class Urgency(str, Enum):
    """Allowed urgency levels for a dispatch request."""
    CRITICAL = "critical"
    HIGH = "high"


class CallStatus(str, Enum):
    """Possible states a donor call can be in."""
    RINGING = "ringing"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    COMPLETED = "completed"


class DonorLanguage(str, Enum):
    """Languages supported for AI voice conversations."""
    TAMIL = "tamil"
    HINDI = "hindi"
    ENGLISH = "english"


# ── Request / Response Schemas ────────────────────────────────────

class Coordinates(BaseModel):
    """Geographic coordinates of the requesting hospital."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")


class DispatchRequest(BaseModel):
    """
    Trigger Payload (Frontend → Backend).
    Sent by the Hospital Web App to initiate an emergency dispatch.
    """
    hospital_id: str = Field(..., min_length=1, description="Unique hospital identifier")
    blood_group: str = Field(..., min_length=1, description="Required blood group, e.g. 'O-'")
    urgency: Urgency = Field(..., description="Urgency level of the request")
    coordinates: Coordinates


class DispatchResponse(BaseModel):
    """Acknowledgement returned after a dispatch is successfully queued."""
    dispatch_id: str = Field(..., description="Unique ID for this dispatch session")
    donors_matched: int = Field(..., ge=0, description="Number of eligible donors found")
    message: str = Field(default="Dispatch initiated")


class DonorStatusUpdate(BaseModel):
    """
    WebSocket Update Payload (Backend → Frontend).
    Streamed to the Hospital Dashboard in real-time as calls progress.
    """
    donor_id: str = Field(..., description="Unique donor identifier")
    name: str = Field(..., description="Donor display name")
    status: CallStatus = Field(..., description="Current call status")
    eta_minutes: Optional[int] = Field(None, ge=0, description="Estimated arrival time in minutes")


# ── Internal Domain Models ────────────────────────────────────────

class DonorNode(BaseModel):
    """
    Mirrors the Donor Node properties stored in Neo4j.
    Used internally — never exposed directly to the frontend.
    """
    id: UUID
    name: str
    phone: str
    blood_group: str
    language: DonorLanguage
    location: Coordinates
    has_app: bool = False
    last_donated_date: Optional[datetime] = None

    @property
    def is_eligible(self) -> bool:
        """Check the 56-day (8-week) medical cooldown rule."""
        if self.last_donated_date is None:
            return True
        delta = datetime.utcnow() - self.last_donated_date
        return delta.days > 56


class DonationLog(BaseModel):
    """Payload sent when hospital staff logs a successful donation."""
    donor_id: str = Field(..., description="Donor whose donation is being recorded")
    hospital_id: str = Field(..., description="Hospital where the donation occurred")
    notes: Optional[str] = Field(None, description="Optional clinical notes")
