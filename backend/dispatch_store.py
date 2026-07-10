"""
In-memory dispatch state store.

Provides a thread-safe, singleton registry that tracks every active
dispatch and maps Exotel call SIDs back to (dispatch_id, donor_id)
pairs.  This allows webhook callbacks and the audio pipeline to find
the dispatch context for any incoming event.

Note: This is an in-process store.  For multi-instance deployments,
replace with Redis or another shared backend.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from backend.schemas.models import CallStatus

logger = logging.getLogger(__name__)


class DispatchStore:
    """
    Singleton store for active dispatch sessions.

    Maintains two indexes:
      • dispatch_id  → full dispatch state dict
      • call_sid     → (dispatch_id, donor_id)   for webhook lookups
    """

    _instance: Optional["DispatchStore"] = None

    def __new__(cls) -> "DispatchStore":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._dispatches: Dict[str, Dict[str, Any]] = {}
            cls._instance._call_sid_index: Dict[str, Tuple[str, str]] = {}
            cls._instance._lock = asyncio.Lock()
        return cls._instance

    # ── Registration ──────────────────────────────────────────────

    async def register_dispatch(
        self,
        dispatch_id: str,
        donors: Dict[str, Dict[str, Any]],
        hospital_id: str = "",
        blood_group: str = "",
        lat: float = 0.0,
        lng: float = 0.0,
    ) -> None:
        """Register a new dispatch and its donor roster."""
        async with self._lock:
            self._dispatches[dispatch_id] = {
                "dispatch_id": dispatch_id,
                "hospital_id": hospital_id,
                "blood_group": blood_group,
                "lat": lat,
                "lng": lng,
                "donors": donors,
                "created_at": datetime.utcnow().isoformat(),
                "is_complete": False,
            }
        logger.info(
            "Dispatch %s registered with %d donors", dispatch_id, len(donors)
        )

    async def register_call(
        self, call_sid: str, dispatch_id: str, donor_id: str
    ) -> None:
        """Map an Exotel call SID to a dispatch + donor pair."""
        async with self._lock:
            self._call_sid_index[call_sid] = (dispatch_id, donor_id)
        logger.debug(
            "Call SID %s registered → dispatch=%s donor=%s",
            call_sid, dispatch_id, donor_id,
        )

    # ── Lookups ───────────────────────────────────────────────────

    async def get_dispatch(self, dispatch_id: str) -> Optional[Dict[str, Any]]:
        """Return the full dispatch state, or None."""
        async with self._lock:
            return self._dispatches.get(dispatch_id)

    async def get_by_call_sid(
        self, call_sid: str
    ) -> Optional[Tuple[str, str]]:
        """Look up (dispatch_id, donor_id) from an Exotel call SID."""
        async with self._lock:
            return self._call_sid_index.get(call_sid)

    async def get_donor(
        self, dispatch_id: str, donor_id: str
    ) -> Optional[Dict[str, Any]]:
        """Return a single donor's state within a dispatch."""
        async with self._lock:
            dispatch = self._dispatches.get(dispatch_id)
            if dispatch:
                return dispatch.get("donors", {}).get(donor_id)
        return None

    # ── Updates ───────────────────────────────────────────────────

    async def update_donor_status(
        self,
        dispatch_id: str,
        donor_id: str,
        status: CallStatus,
        eta_minutes: Optional[int] = None,
    ) -> bool:
        """
        Update a donor's call status within a dispatch.
        Returns True if the update was applied.
        """
        async with self._lock:
            dispatch = self._dispatches.get(dispatch_id)
            if not dispatch:
                logger.warning("update_donor_status: dispatch %s not found", dispatch_id)
                return False

            donor = dispatch.get("donors", {}).get(donor_id)
            if not donor:
                logger.warning(
                    "update_donor_status: donor %s not in dispatch %s",
                    donor_id, dispatch_id,
                )
                return False

            donor["status"] = status
            if eta_minutes is not None:
                donor["eta_minutes"] = eta_minutes

        logger.info(
            "Donor %s in dispatch %s → %s",
            donor_id, dispatch_id, status.value,
        )
        return True

    async def mark_complete(self, dispatch_id: str) -> None:
        """Mark a dispatch as fully completed."""
        async with self._lock:
            dispatch = self._dispatches.get(dispatch_id)
            if dispatch:
                dispatch["is_complete"] = True
        logger.info("Dispatch %s marked complete", dispatch_id)

    # ── Cleanup ───────────────────────────────────────────────────

    async def remove_dispatch(self, dispatch_id: str) -> None:
        """Remove a finished dispatch and all its call SID mappings."""
        async with self._lock:
            self._dispatches.pop(dispatch_id, None)
            # Purge call SID index entries for this dispatch.
            sids_to_remove = [
                sid
                for sid, (did, _) in self._call_sid_index.items()
                if did == dispatch_id
            ]
            for sid in sids_to_remove:
                del self._call_sid_index[sid]
        logger.info(
            "Dispatch %s removed (%d call SIDs purged)",
            dispatch_id, len(sids_to_remove) if "sids_to_remove" in dir() else 0,
        )

    # ── Diagnostics ───────────────────────────────────────────────

    async def active_count(self) -> int:
        """Return the number of active dispatches."""
        async with self._lock:
            return len(self._dispatches)

    async def summary(self) -> List[Dict[str, Any]]:
        """Return a compact summary of all active dispatches."""
        async with self._lock:
            return [
                {
                    "dispatch_id": d["dispatch_id"],
                    "donors": len(d.get("donors", {})),
                    "is_complete": d.get("is_complete", False),
                    "created_at": d.get("created_at"),
                }
                for d in self._dispatches.values()
            ]


# Singleton instance — import this everywhere.
dispatch_store = DispatchStore()
