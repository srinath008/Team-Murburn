# 🚀 AI Blood Dispatch - Free Deployment Guide

This guide walks you through deploying the complete stack for **free**, ensuring high availability and scalability using modern cloud providers.

## 1. Database: Neo4j AuraDB (Already Setup)
You are already using Neo4j AuraDB Free Tier. It scales automatically and is securely hosted. Keep your `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` handy for the backend deployment.

---

## 2. Backend: Render (Docker / FastAPI)
We will use [Render](https://render.com/) for the backend because their Free Tier **does not require a credit card** (unlike Koyeb or Fly.io). 

*Note: Render's free tier spins down after 15 minutes of inactivity. To prevent this (which would break your emergency Twilio calls), we will set up a free pinger.*

1. Create a free account at [Render](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your GitHub repository.
4. **Configure the Service**:
   - **Language/Environment**: Docker
   - **Root Directory**: `backend`
   - **Instance Type**: Free
   - **Environment Variables** (Click "Advanced" to add these from your `.env`):
     - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
     - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
     - `SARVAM_API_KEY`
     - `APP_ENV=production`
     - `JWT_SECRET=your_secure_random_string`
     - `CORS_ORIGINS=["https://your-vercel-domain.vercel.app"]` (Add this after deploying Vercel).
     - `SERVER_BASE_URL` (Wait until Render gives you your public domain, e.g., `https://my-app.onrender.com`, then add it here).
5. Click **Create Web Service**. Render will build and deploy your Docker container.

### 2a. Stop the Server from Sleeping (Crucial!)
To ensure the AI is always awake to receive Twilio emergency calls:
1. Go to [cron-job.org](https://cron-job.org/) (100% free, no credit card).
2. Create a new cron job that pings your new Render URL (e.g., `https://my-app.onrender.com/api/health`) every **14 minutes**. This tricks Render into staying awake 24/7!

*(Don't forget to update your Twilio Webhook URL to point to your new Render domain instead of Ngrok!)*

---

## 3. Web Dashboard: Vercel (React / Expo Web)
[Vercel](https://vercel.com/) is the absolute best place to host the Hospital Dashboard. It automatically hosts the static bundle on a global Edge CDN for lightning-fast speeds.

1. Push your code to GitHub.
2. Log into Vercel and click **Add New Project**.
3. Select your GitHub repository.
4. Vercel will ask you to configure the build:
   - **Root Directory**: Select `frontend/donor-web`.
   - **Framework Preset**: Vercel should auto-detect **Other** or **Create React App**. Since it's Expo, leave it as is or type `expo export -p web` if it asks for a build command. Usually, it works automatically!
   - **Environment Variables**: Add your backend URL here:
     - `EXPO_PUBLIC_API_URL=https://your-app.onrender.com`
     - `EXPO_PUBLIC_WS_URL=wss://your-app.onrender.com/ws/dashboard`
5. Click **Deploy**. Vercel will give you a live HTTPS domain (e.g. `https://hospital-dashboard.vercel.app`).
6. *Important*: Take this Vercel domain and add it to your Render `CORS_ORIGINS` environment variable so the backend allows requests from it.

---

## 4. Mobile App: Expo EAS (Android APK)
To distribute the Donor App to physical phones, you can use Expo Application Services (EAS) to build the `.apk` file entirely in the cloud for free.

1. Open your terminal in the mobile folder: `cd frontend/donor-mobile`
2. Install the EAS CLI globally: `npm install -g eas-cli`
3. Log in to Expo: `eas login`
4. Update the `SERVER_BASE_URL` inside `DonorApp.js` to your new Render domain.
5. Run the cloud build:
   ```bash
   eas build --platform android --profile production
   ```
6. Wait 5-10 minutes. The terminal will give you a direct download link to the `.apk` file that you can install on any Android phone!

## Maintenance & CI/CD
Whenever you push new code to your GitHub `main` branch, **Render** and **Vercel** will automatically rebuild and deploy your changes with zero downtime!
