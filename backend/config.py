"""
Centralised application settings loaded from environment variables.

Uses pydantic-settings so every value can be overridden via a `.env`
file sitting next to this module or via real env vars in production.
"""

from __future__ import annotations

import json
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All external configuration the backend needs at runtime."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Neo4j AuraDB ──────────────────────────────────────────────
    neo4j_uri: str = "neo4j+s://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""

    # ── Exotel Telephony ──────────────────────────────────────────
    exotel_api_key: str = ""
    exotel_api_token: str = ""
    exotel_sid: str = ""
    exotel_subdomain: str = ""
    exotel_caller_id: str = ""

    # ── Sarvam AI (STT / TTS) ────────────────────────────────────
    sarvam_api_key: str = ""
    sarvam_base_url: str = "https://api.sarvam.ai"

    # ── App Settings ─────────────────────────────────────────────
    app_env: str = "development"
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:19006"]
    server_base_url: str = "http://localhost:8000"

    # ── Expo Push Notifications ──────────────────────────────────
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"

    # ── Exotel Audio Streaming ───────────────────────────────────
    exotel_audio_ws_path: str = "/ws/exotel/audio-stream"

    # pydantic-settings doesn't auto-parse JSON lists from env vars,
    # so we accept a raw string and coerce it ourselves.
    @classmethod
    def parse_cors(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            return json.loads(v)
        return v


# Singleton instance — import this everywhere.
settings = Settings()
