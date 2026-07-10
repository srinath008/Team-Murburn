# MASTER SYSTEM INSTRUCTIONS: AI BLOOD NETWORK BACKEND

## 1. Project Context
We are building an AI-powered emergency blood dispatch network. The system allows a hospital to trigger an emergency, which queries a Neo4j Graph Database for eligible donors within 10km who have not donated in the last 56 days. The system uses LangGraph to trigger simultaneous outbound phone calls via Exotel. Sarvam AI handles real-time multi-lingual voice conversations. Donors who accept are sent either an Expo push notification (if they have the app) or an SMS with a web tracking link. 

## 2. Your Domain: The Core Engine
**Directory Restriction:** `backend/`
**AI DIRECTIVE:** You are assisting the Backend Lead. You are strictly forbidden from generating or modifying any code in the `frontend/`, `mobile/`, or `database/` directories. Confine all Python and API logic to the `backend/` folder.

## 3. Technical Specifications & Tasks
* **Framework:** Python FastAPI.
* **Orchestration:** LangGraph (StateGraph) for managing the call state (Ringing -> Answered -> Accepted/Declined).
* **Concurrency:** Use `asyncio` to handle simultaneous Exotel API webhook requests.
* **Real-Time Comms:** Implement a WebSocket server route (`/ws/dashboard`) to stream call status updates to the frontend in real-time.
* **AI Integration:** Create an asynchronous streaming pipeline to connect Exotel's audio websocket to Sarvam AI's STT/TTS models. 

## 4. Git & Collaboration Workflow
* **Branching:** All backend work must happen on branches prefixed with `backend/` (e.g., `git checkout -b backend/langgraph-setup`).
* **API Contracts:** Do not write database logic (Cypher queries). Call the functions provided by the Database Engineer in `backend/db_services/`.
* **Merge Rules:** Never push directly to `main`. Create a Pull Request and ensure the FastAPI server runs locally before merging.