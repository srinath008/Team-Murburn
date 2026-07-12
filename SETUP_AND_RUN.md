# AI Blood Dispatch Network - Setup & Troubleshooting Guide

Welcome to the project! This guide will walk you through exactly how to run the full stack locally, configure the AI voice agent, and avoid the complex networking pitfalls we encountered during development.

---

## 🏗️ 1. Project Architecture

The system consists of three main pieces:
1. **FastAPI Backend (Dockerized):** Handles LangGraph orchestration, Twilio webhooks, and Sarvam AI requests.
2. **React Web Dashboard:** Used by hospital dispatchers to trigger emergencies.
3. **React Native (Expo) Mobile App:** Used by donors to register their profiles and locations.

---

## ⚙️ 2. Step-by-Step Setup Instructions

### A. Start the Backend & Tunnel
Because Twilio needs to stream live audio to our backend over the internet, we **must** expose our local backend using a tunnel like `ngrok`.

1. **Start Ngrok:**
   ```bash
   # Run ngrok to expose port 8000
   ngrok http 8000
   ```
   *Copy the generated HTTPS URL (e.g., `https://1234-abcd.ngrok-free.app`).*

2. **Configure `.env`:**
   In the root folder, duplicate `.env.example` to `.env` and fill it out:
   ```env
   SERVER_BASE_URL=https://1234-abcd.ngrok-free.app  # Your ngrok URL!
   NEO4J_URI=...
   NEO4J_USER=...
   NEO4J_PASSWORD=...
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=...
   SARVAM_API_KEY=...
   ```

3. **Start the Backend Container:**
   ```bash
   docker compose up -d --build
   ```

### B. Start the Frontend Interfaces
1. **Hospital Dashboard (Web):**
   ```bash
   cd frontend/donor-web
   npm install
   npm start
   ```
2. **Donor App (Mobile):**
   ```bash
   cd frontend/donor-mobile
   npm install
   npm start
   ```
   *Scan the QR code with your phone's camera (iOS) or Expo Go app (Android).*

---

## 🚨 3. Critical Configuration (Don't Skip!)

### 📞 Twilio WebSockets Routing
Twilio requires a **TwiML** response to bridge the phone call to our live backend WebSocket.
1. Go to your Twilio Console -> Active Numbers.
2. Under "A call comes in", set the Webhook URL to: `https://<YOUR-NGROK-URL>/api/twilio/twiml`
3. Ensure the HTTP method is **POST**.
*(The backend is already programmed to respond with the exact `<Connect><Stream>` XML needed for Sarvam AI to take over).*

### 📱 Expo App API Routing
Whenever your Ngrok URL changes, you **must** update the `SERVER_BASE_URL` hardcoded inside `frontend/donor-mobile/components/DonorApp.js`. 
If you forget this, the mobile app will try to send registrations to an expired tunnel and throw a network error!

---

## 🛠️ 4. Known Issues & Troubleshooting

We ran into several highly specific bugs during development. If you experience issues, check this list first:

#### ❌ Issue 1: Mobile App says "Network Request Failed" during Registration
**The Cause:** Ngrok's free tier intercepts browser/app requests with a "Warning: Visit Site" HTML page. Because React Native's `fetch` expects an API response, this HTML page breaks the CORS preflight, failing the request silently.
**The Fix (Already Implemented):** We added the `'ngrok-skip-browser-warning': 'true'` header to the `fetch()` call in `DonorApp.js`. 
*Note: If you edit the mobile app code, always press `Shift + R` in the Expo terminal to clear the cache, otherwise your phone will keep running the broken cached version!*

#### ❌ Issue 2: Mobile App still fails to connect to backend
**The Cause:** The FastAPI backend's CORS policy was restricting traffic to `localhost:3000`. When running Expo on a physical device, the phone has a different LAN IP address, causing the backend to instantly block the connection.
**The Fix (Already Implemented):** In `backend/main.py`, the CORS middleware `allow_origins` is set to `["*"]` to allow your physical phone to communicate with the local server.

#### ❌ Issue 3: Web Dashboard suddenly switches to "Simulation Mode"
**The Cause:** We use the free tier of Neo4j AuraDB. If the database sits idle for too long, it aggressively drops its connection to save resources. When the dashboard triggers a dispatch, the backend `POST /api/dispatch` crashes with a `neo4j.exceptions.SessionExpired` error. The frontend detects the crash and falls back to a visual simulation.
**The Fix:** Simply restart the backend docker container to instantly re-establish a fresh Neo4j connection pool:
```bash
docker compose restart backend
```

#### ❌ Issue 4: Sarvam AI keeps repeating the prompt / failing to understand Regional Languages (e.g. Tamil)
**The Cause:** When a donor speaks a regional language, Sarvam's Speech-to-Text (STT) returns the transcript in the **native script** (e.g., returning `"சரி"` instead of `"sari"`). If our Python keyword matching logic only checks for English transliterations, the AI assumes the intent was invalid and repeats the question.
**The Fix (Already Implemented):** In `backend/services/voice_pipeline.py`, both the English alphabet translations AND the native script characters (Hindi/Tamil) have been added to the `_ACCEPT_KEYWORDS` and `_DECLINE_KEYWORDS` dictionaries. If you add a new language (like Telugu), ensure you add the native script words to that dictionary!
