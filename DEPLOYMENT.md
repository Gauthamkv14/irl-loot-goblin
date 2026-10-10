# DEPLOYMENT.md — IRL Loot Goblin Render Web Service Deployment Guide

This guide documents the exact configuration required to deploy **IRL Loot Goblin** to [Render](https://render.com) as a single, unified Node.js Web Service serving both the Express API and the built React frontend.

---

## 1. Architectural Model

- **Service Type**: **Web Service** (Linux / Node runtime).
- **Single Host**: One unified Render Web Service hosts both `/api/*` endpoints and serves the static production build of the frontend (`client/dist`).
- **No Cross-Origin Issues**: Because the frontend and backend share the exact same origin in production, there are no CORS complexities or secondary serverless timeout limits.
- **Port Binding**: The Node server listens dynamically on `process.env.PORT` (automatically injected by Render).

---

## 2. Render Web Service Dashboard Settings

When creating the new Web Service in your Render Dashboard:

| Field | Setting / Value | Notes |
| :--- | :--- | :--- |
| **Service Type** | **Web Service** | Do not deploy as a Static Site or background worker. |
| **Repository** | Your connected GitHub repository | Public or private repository. |
| **Branch** | `main` (or default branch) | Auto-deploy on push is supported. |
| **Root Directory** | *(Leave blank / empty)* | Operates at the repo root. |
| **Runtime** | **Node** | Node 20+ (Render default LTS). |
| **Build Command** | `npm run build` | Runs `client install`, `vite build`, and `server install`. |
| **Start Command** | `npm start` | Runs `node server/index.js`. |
| **Instance Type** | Free (or Starter) | Free tier instances sleep after inactivity. |
| **Health Check Path** | `/api/health` | Used by Render to verify deployment health. |

---

## 3. Environment Variables

Configure the following environment variables in the Render Dashboard (**Dashboard $\rightarrow$ Environment $\rightarrow$ Add Environment Variable**):

| Variable Name | Required Value / Description | Example |
| :--- | :--- | :--- |
| `NODE_VERSION` | `20` (or `22`) | Ensures Render runs a compatible Node LTS version. |
| `PROVIDER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI-compatible endpoint base URL. |
| `PROVIDER_API_KEY` | *(Your private OpenRouter API key)* | Starts with `sk-or-v1-...`. Never commit to Git! |
| `MODEL_ID` | `dots-studio/dots-3-note-preview:free` | Exact verified free open-weight vision model. |

> [!WARNING]
> Never set `PROVIDER_API_KEY` in client-side Vite variables (`VITE_*`) or commit `.env` files into GitHub. The key must live exclusively in Render's server environment.

---

## 4. Build & Startup Lifecycle

1. **Build Phase (`npm run build`)**:
   - `npm --prefix client install`: Installs React, Vite, and Tailwind dependencies.
   - `npm --prefix client run build`: Compiles the React SPA into static assets in `client/dist`.
   - `npm --prefix server install`: Installs backend dependencies (`express`, `multer`, `zod`, `cors`, `express-rate-limit`, `dotenv`).
2. **Start Phase (`npm start`)**:
   - Executes `node server/index.js`.
   - Binds to `process.env.PORT`.
   - Configures `/api/health` and `/api/appraise`.
   - Statically mounts `client/dist` and routes non-API GET requests to `index.html`.

---

## 5. Post-Deployment Verification Steps

Once Render reports that the deployment is live:

1. **Verify Health Endpoint**:
   - Navigate to `https://<your-render-subdomain>.onrender.com/api/health`.
   - Expected JSON response:
     ```json
     {
       "ok": true,
       "status": "healthy",
       "providerConfigured": true,
       "timestamp": "..."
     }
     ```
2. **Verify Frontend UI**:
   - Visit `https://<your-render-subdomain>.onrender.com/`.
   - Confirm that the "IRL Loot Goblin" landing screen displays with dark fantasy styling and the upload dropzone.
3. **Verify Camera / File Appraisal**:
   - Upload or photograph a real object (e.g., leaf, rock, twig).
   - Verify the loading goblin squinting animation appears.
   - Confirm that after ~20–25s, a completed Loot Card appears with rarity, stats, flavor lore, and the `✓ Certified Appraisal` badge.
4. **Inspect Server Logs**:
   - Review Render service logs to ensure no credentials or raw image payloads are logged.

---

## 6. Troubleshooting & Operational Notes

### Free-Tier Cold Starts
- **Symptom**: The first visit takes 30–60 seconds to open or the initial health check pauses.
- **Cause**: Render Free tier instances spin down after 15 minutes of inactivity.
- **Mitigation**: Before recording a demo or presenting the app, visit `/api/health` a minute in advance to warm up the instance.

### Upstream Rate Limits (HTTP 429)
- **Symptom**: Appraisal card displays `⚠ Demo Fallback` instead of `✓ Certified Appraisal`.
- **Cause**: The free OpenRouter model (`dots-studio/dots-3-note-preview:free`) is shared globally and may briefly throttle under high traffic.
- **Handling**: The backend catches upstream 429 responses, does not crash, and cleanly provides a schema-compliant fallback card with an explicit fallback disclaimer.

### Missing Environment Variables
- **Symptom**: `/api/health` reports `"providerConfigured": false`.
- **Solution**: Confirm that `PROVIDER_API_KEY`, `PROVIDER_BASE_URL`, and `MODEL_ID` are entered in Render's **Environment** tab without leading/trailing whitespace.
