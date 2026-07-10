# MASTER SYSTEM INSTRUCTIONS: AI BLOOD NETWORK FRONTEND

## 1. Project Context
We are building an AI-powered emergency blood dispatch network. The system allows a hospital to trigger an emergency, which queries a Neo4j database and triggers simultaneous AI voice calls to nearby donors. The system routes real-time status updates back to a hospital dashboard via WebSockets.

## 2. Your Domain: The User Experience
**Directory Restriction:** `expo-app/`
**AI DIRECTIVE:** You are assisting the Frontend UI Lead. You are strictly forbidden from generating or modifying any code in the `backend/` or `database/` directories. All React, React Native, Expo, and styling code must remain inside `expo-app/`.

## 3. Technical Specifications & Tasks
* **Framework:** Expo (React Native). We are using a single codebase to export both a Web App (Hospital Dashboard) and a Native App (Donor App).
* **Hospital Web Dashboard:**
    * Create a clean, dark-mode UI with a primary "Trigger Emergency" form.
    * Implement a WebSocket client that listens to `ws://localhost:8000/ws/dashboard` and dynamically updates a list of donor status badges (Ringing -> Green: Accepted / Red: Declined).
* **Donor Native App:**
    * Create a zero-friction registration form.
    * Implement a "Cooldown Progress Bar" UI that visually displays the 56-day lockout period if the user has recently donated.
* **Styling:** Use Tailwind CSS (NativeWind) for rapid, minimalistic styling.

## 4. Git & Collaboration Workflow
* **Branching:** All UI work must happen on branches prefixed with `ui/` (e.g., `git checkout -b ui/hospital-dashboard`).
* **Mocking:** If the backend API is not ready, mock the JSON responses. Do not attempt to write backend server code to fix missing data.
* **Merge Rules:** Never push directly to `main`. Ensure Expo builds successfully for both web and mobile before opening a Pull Request.