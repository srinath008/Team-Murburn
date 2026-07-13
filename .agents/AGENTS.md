# Agent Rules

## Python Async Testing (Neo4j)
When testing Python applications in this codebase that use asynchronous context managers (like Neo4j async sessions in `async with` blocks), you must mock them by explicitly configuring the `__aenter__` and `__aexit__` methods.
Standard `AsyncMock` instances cannot be used directly as async context managers. 

**Example:**
```python
session_cm = AsyncMock()
session_cm.__aenter__.return_value = mock_session
session_cm.__aexit__.return_value = False
mock_driver.session.return_value = session_cm
```

## Phone Number Limits
When creating or modifying phone number input fields in the UI, always enforce a reasonable character limit (e.g., using `maxLength={15}`) to prevent excessively long entries and protect the layout/database.

## HaemNet Project Deep Context
**Project Overview:** HaemNet is a real-time, AI-orchestrated emergency blood dispatch system. It queries a graph database for eligible donors (within 10km, no donations in last 56 days) and orchestrates simultaneous multilingual AI voice calls via Twilio & Sarvam AI.
**Tech Stack:**
- **Database:** Neo4j AuraDB (Graph Database) for spatial/temporal constraints.
- **Backend:** Python FastAPI. Handles REST, WebSockets (`/ws/dashboard` for live updates), and business logic.
- **AI Orchestration:** LangGraph (StateGraph) for managing concurrent outbound calls state.
- **Voice AI:** Twilio (telephony) + Sarvam AI (low-latency STT/TTS in Indian languages).
- **Frontend/Mobile:** Expo (React Native). Compiles to Web (Hospital Dashboard) and Mobile (Donor App).
**Core Workflows:**
- **Emergency Dispatch:** FastAPI queries Neo4j -> LangGraph triggers concurrent Twilio calls -> Sarvam AI converses -> WebSockets update Hospital Dashboard.
- **Intelligent Routing:** If donor accepts & has app (`has_app: true`), send Expo Push Notification for map routing. Fallback: SMS with web-tracking link.
- **Medical Cooldown:** Post-donation, Neo4j `last_donated_date` is updated, locking donor out of spatial queries for 56 days.
**Agent Directives:**
- Backend code goes strictly in `backend/` (FastAPI, LangGraph). Use provided DB services, no raw Cypher in routes.
- Frontend/Mobile code goes strictly in `frontend/` (Expo, React Native).
