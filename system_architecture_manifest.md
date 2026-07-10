# GLOBAL SYSTEM ARCHITECTURE MANIFEST: AI BLOOD DISPATCH NETWORK

## 1. Executive Summary
This project is a real-time, AI-orchestrated emergency blood dispatch system. It acts as a closed-loop network controlled entirely by authorized hospital personnel to mitigate donor notification fatigue. When an emergency is triggered, the system queries a graph database for eligible nearby donors, orchestrates simultaneous multilingual AI voice calls to dispatch them, and provides a real-time WebSocket dashboard for hospital staff to track donor acceptance. 

## 2. The Technology Stack
* **Database Engine:** Neo4j AuraDB (Graph Database). Chosen for high-performance spatial queries (10km radius) and strict temporal filtering (56-day cooldown).
* **Backend & API:** Python FastAPI. Handles REST endpoints, WebSocket connections, and business logic routing.
* **AI Orchestration:** LangGraph (StateGraph). Manages the state machine for concurrent outbound calls and decision routing.
* **Telephony & Voice:** Exotel (concurrent outbound dialing webhook) + Sarvam AI (low-latency, localized Indian language STT/TTS).
* **Frontend & Mobile:** Expo (React Native). Compiles to both a Web App (Hospital Dashboard) and a Native Mobile App (Donor Application).
* **Infrastructure:** Dockerized containers ready for serverless scaling (Google Cloud Run/Render).

## 3. Core System Workflows

### A. The Emergency Dispatch Flow
1.  **Trigger:** Hospital Web App sends a POST request (`/api/dispatch`) with `blood_group`, `urgency`, and `hospital_coordinates`.
2.  **Query:** FastAPI queries Neo4j to find Donor Nodes matching the `blood_group` AND within a 10km spatial radius AND where `last_donated_date` is either NULL or > 56 days ago.
3.  **Orchestration:** LangGraph triggers concurrent asynchronous outbound calls via Exotel to all matched donors.
4.  **AI Voice:** Exotel routes the audio stream to Sarvam AI. The AI agent converses in the donor's native language to request immediate assistance.
5.  **Live Updates:** As calls progress, FastAPI pushes state changes (Ringing, Accepted, Declined) to the Hospital Web App via WebSockets (`ws://.../ws/dashboard`).

### B. The Intelligent Routing Flow (Post-Acceptance)
When a donor verbally confirms availability to the AI agent:
1.  FastAPI checks the donor's `has_app` boolean flag in Neo4j.
2.  **Native Path (`has_app: true`):** Sends an Expo Push Notification triggering the native app to open a map route.
3.  **Fallback Path (`has_app: false`):** Triggers Exotel to send an SMS with a lightweight HTML web-tracking link.

### C. The Medical Cooldown Flow
1.  Hospital staff clicks "Log Donation" on the Web App after a successful transfusion.
2.  FastAPI sends a Cypher query to Neo4j updating the donor node's `last_donated_date` to the current timestamp.
3.  For the next 56 days, this donor is mathematically excluded from all spatial queries, and the native Expo app renders a "Recovery Progress Bar".

## 4. Strict Data Contracts (JSON Schemas)
To prevent integration clashes, all AI agents MUST adhere to these exact payload structures.

**Trigger Payload (Frontend -> Backend)**
```json
{
  "hospital_id": "string",
  "blood_group": "string (e.g., 'O-')",
  "urgency": "string ('critical' | 'high')",
  "coordinates": { "lat": "float", "lng": "float" }
}

WebSocket Update Payload (Backend -> Frontend)

JSON
{
  "donor_id": "string",
  "name": "string",
  "status": "string ('ringing' | 'accepted' | 'declined' | 'completed')",
  "eta_minutes": "integer (nullable)"
}

Donor Node Properties (Neo4j)

JSON
{
  "id": "UUID",
  "name": "string",
  "phone": "string",
  "blood_group": "string",
  "language": "string ('tamil' | 'hindi' | 'english')",
  "location": "Point (spatial)",
  "has_app": "boolean",
  "last_donated_date": "datetime (nullable)"
}