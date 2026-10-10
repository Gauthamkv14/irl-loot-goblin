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
| `LOOT_SIGNING_SECRET` | *(Required in Prod)* 64-character hex secret for server-authoritative HMAC signing. | Generate via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SUPABASE_URL` | *(Optional for Auth)* Your Supabase project URL for server token verification. | `https://xyzproject.supabase.co` |
| `SUPABASE_ANON_KEY` | *(Optional for Auth)* Your Supabase anon key for server token verification. | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Optional for Progression)* Server-only key to execute private atomic progression RPC. | `eyJhbGciOi...` |
| `VITE_SUPABASE_URL` | *(Optional for Auth)* Your Supabase project URL for frontend client. | `https://xyzproject.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(Optional for Auth)* Your Supabase publishable/anon key for frontend client. | `eyJhbGciOi...` |

> [!WARNING]
> Never set `PROVIDER_API_KEY`, `LOOT_SIGNING_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` in client-side Vite variables (`VITE_*`) or commit `.env` files into GitHub. Secrets must live exclusively in Render's server environment. Keep `LOOT_SIGNING_SECRET` stable across redeployments so previously appraised items remain savable.

---

### Supabase Database Migration Setup

1. Open your hosted Supabase project dashboard at [supabase.com](https://supabase.com).
2. Go to **SQL Editor $\rightarrow$ New Query**.
3. Apply the migrations in sequence:
   - `supabase/migrations/20261010000000_initial_schema.sql` (Phase 5 base schema & profiles trigger)
   - `supabase/migrations/20261011000000_phase6_progression.sql` (Phase 6 base progression tables)
   - `supabase/migrations/20261011020000_private_rpc_security_remediation.sql` (Private schema `goblin_internal` & atomic progression RPC)
   - `supabase/migrations/20261011030000_phase7_leaderboards_and_trading.sql` (Phase 7 public profiles, leaderboard view, trade tables, and trading RPCs)
4. Verify that:
   - `public.profiles` and `public.loot_items` tables are created with Row Level Security (RLS) enabled.
   - `profiles` contains `is_public` (defaulting to false) and `public_title`.
   - `trade_offers` and `trade_history` tables are created with RLS enabled and direct write privileges (`INSERT, UPDATE, DELETE`) revoked from `anon` and `authenticated`.
   - The trigger `on_auth_user_created` is attached to `auth.users`.
   - Direct write privileges (`INSERT, UPDATE, DELETE`) on `user_progression`, `daily_quest_progress`, `hunt_progress`, and `user_achievements` are revoked from `anon` and `authenticated`.
   - The view `public.public_leaderboard_view` exists and filters strictly on `is_public = true`.
   - The atomic transaction functions `goblin_internal.hoard_relic_atomic`, `goblin_internal.execute_trade_atomic`, and `goblin_internal.cancel_trade_atomic` exist inside `goblin_internal` with `SECURITY DEFINER` and `EXECUTE` granted exclusively to `service_role`.

### PostgREST Exposed Schemas Configuration
In the Supabase Dashboard:
- Navigate to **Project Settings $\rightarrow$ API $\rightarrow$ Extra search path / Exposed schemas**.
- Add `goblin_internal` to the exposed schemas list (alongside `public`).
- **Security Guarantee:** Because `REVOKE USAGE ON SCHEMA goblin_internal FROM PUBLIC, anon, authenticated;` is enforced in the migration, PostgREST will strictly forbid requests from `anon` or ordinary `authenticated` tokens. Only the Express server client authenticating with `SUPABASE_SERVICE_ROLE_KEY` can access `goblin_internal` to execute `hoard_relic_atomic`, `execute_trade_atomic`, and `cancel_trade_atomic`. Direct browser/client calls remain completely blocked.

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
