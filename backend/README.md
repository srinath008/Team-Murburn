# HaemNet Backend

The backend of HaemNet is the brain of the emergency blood dispatch system. It is responsible for orchestrating real-time AI voice calls, communicating with the graph database, and managing the live WebSocket dashboard for hospitals.

## Tech Stack
- **Framework:** Python FastAPI
- **AI Orchestration:** LangGraph (StateGraph) & LangChain
- **Telephony & Voice AI:** Twilio + Sarvam AI (Streaming WebSockets)
- **Database Connectivity:** Neo4j Python Driver
- **Concurrency:** `asyncio` for parallel outbound dialing

## System Architecture

### 1. The Dispatch Engine (`orchestration/graph.py`)
At the core of the backend is a state machine built with LangGraph. When a hospital triggers an emergency dispatch, the graph:
1. Initiates concurrent Twilio calls to all eligible donors.
2. Tracks the state of each call (`RINGING` -> `ANSWERED` -> `ACCEPTED`/`DECLINED`).
3. Streams the ongoing state changes back to the frontend via WebSockets.

### 2. Conversational Voice AI (`api/callbacks.py` & `services/`)
When a donor answers the phone, Twilio connects via WebSocket to our FastAPI server. The backend intercepts the raw audio stream, pipes it through Sarvam AI for low-latency Speech-to-Text and Text-to-Speech in the donor's native language (e.g., Hindi, Tamil, English), and streams the AI's response back to Twilio.

### 3. Spatial & Temporal Constraints (`db_services/`)
The backend interfaces with Neo4j to enforce strict medical guidelines:
- **Spatial:** Donors must be within a 10km radius of the hospital's coordinates.
- **Temporal:** Donors are mathematically locked out of the query if their `last_donated_date` is less than 56 days ago.

## Getting Started

### Prerequisites
- Python 3.9+
- Neo4j AuraDB credentials
- Twilio Account SID, Auth Token, and Phone Number
- Sarvam AI API Key

### Installation

1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Configure your environment variables:
   Copy `.env.example` to `.env` and fill in your API keys.

3. Run the development server:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://localhost:8000` and the interactive docs at `http://localhost:8000/docs`.

## Deployment
This backend is designed to be dockerized and deployed to platforms like Render or Google Cloud Run. Ensure that your deployment platform supports WebSocket connections for the Twilio audio streams and the frontend dashboard.
