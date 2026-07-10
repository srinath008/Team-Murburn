"""
db_services — Database abstraction layer.

╔══════════════════════════════════════════════════════════════════╗
║  IMPORTANT: This module is owned by the Database Engineer.      ║
║  Backend developers MUST NOT write raw Cypher queries.          ║
║  Instead, call the async functions exported from this package.  ║
╚══════════════════════════════════════════════════════════════════╝

The stubs below define the interface contract that the backend
expects.  The DB engineer will implement the real Neo4j logic.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from backend.schemas.models import DonorNode

logger = logging.getLogger(__name__)


async def find_eligible_donors(
    blood_group: str,
    lat: float,
    lng: float,
    radius_km: float = 10.0,
    cooldown_days: int = 56,
) -> List[DonorNode]:
    """
    Query Neo4j for donors matching:
      • blood_group
      • within `radius_km` of (lat, lng)
      • last_donated_date is NULL **or** > `cooldown_days` days ago

    Returns a list of DonorNode models.
    """
    # TODO: DB Engineer — replace with real Cypher spatial query
    logger.warning("find_eligible_donors() is using a STUB — no real DB call yet.")
    return []


async def update_donation_date(
    donor_id: str,
    donated_at: Optional[datetime] = None,
) -> bool:
    """
    Set `last_donated_date` on the donor node to `donated_at`
    (defaults to utcnow). Returns True on success.
    """
    # TODO: DB Engineer — implement Cypher UPDATE
    logger.warning("update_donation_date() is using a STUB — no real DB call yet.")
    return True


async def get_donor_by_id(donor_id: str) -> Optional[DonorNode]:
    """
    Fetch a single donor node by its UUID.
    Returns None if not found.
    """
    # TODO: DB Engineer — implement Cypher MATCH
    logger.warning("get_donor_by_id() is using a STUB — no real DB call yet.")
    return None


async def get_donor_push_token(donor_id: str) -> Optional[str]:
    """
    Fetch the Expo push token for a donor who has the mobile app.
    Returns None if the donor has no push token registered.

    The mobile app stores the push token in Neo4j when the donor
    registers / logs in.
    """
    # TODO: DB Engineer — implement Cypher MATCH for push token
    logger.warning("get_donor_push_token() is using a STUB — no real DB call yet.")
    return None
