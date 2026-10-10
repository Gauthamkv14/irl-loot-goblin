# 👹 LootGoblin

<p align="center">
  <strong>Touch grass. Find loot.</strong><br />
  Turn the ordinary world into an extraordinary RPG adventure.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Phase_5_Complete-f59e0b?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/React-Vite-61dafb?style=for-the-badge&logo=react&logoColor=111827" alt="React + Vite" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js and Express" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/AI-OpenRouter-7c3aed?style=for-the-badge" alt="OpenRouter" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <a href="#-the-idea">The Idea</a> ·
  <a href="#-how-it-works">How It Works</a> ·
  <a href="#-key-features">Key Features</a> ·
  <a href="#-architecture--tech-stack">Architecture & Tech Stack</a> ·
  <a href="#-phase-5-authentication--persistent-inventory">Phase 5 Details</a> ·
  <a href="#-prerequisites--quick-start">Quick Start</a> ·
  <a href="#-environment-variables">Environment Variables</a> ·
  <a href="#-database-setup-supabase">Database Setup</a> ·
  <a href="#-tests--validation">Tests</a> ·
  <a href="#-render-deployment">Deployment</a> ·
  <a href="#-troubleshooting">Troubleshooting</a> ·
  <a href="#-license">License</a>
</p>

---

## 🎒 The Idea

What if that random leaf on your morning walk was actually a **Legendary Nature Relic**?

**LootGoblin** is a real-world collectible RPG that turns everyday objects into fictional game loot. Snap a picture of something you discover outdoors, let AI analyze its visual features and spin imaginative RPG lore, and watch as the backend rolls rarity, attributes, and Goblin Coins.

A dried leaf becomes an enchanted arcane talisman. A quartz pebble becomes a dragon-forged rune. A crooked branch becomes an apprentice druid staff.

The world is your loot table.

> **The Goblin Code:** Real-world exploration, fictional rewards. Take only photos, leave everything where you found it.

---

## 🗺️ How It Works

```text
       REAL WORLD
           │
           ▼
    📸 1. Client Photo Capture (Mobile camera or file upload)
           │ (Canvas client-side resize: 1024px max edge, JPEG ~0.8, < 4 MB)
           ▼
    🛡️ 2. Express Backend Validation (MIME & image magic bytes verification)
           │
           ├──▶ AI Vision Appraisal (OpenRouter OpenAI-compatible API)
           │    Creative narrative: Name, Type, Lore, Ability, Visual Observation
           │
           └──▶ Server-Authoritative Game Mechanics
                • Deterministic Rarity Roll (Common -> Legendary)
                • Bounded Stat Budgets (ATK, DEF, SPD, INT, LUCK)
                • Goblin Coin Value Range (Rarity-weighted)
                • Cryptographic HMAC SHA-256 Signature (Full canonical payload)
           │
           ▼
    ✨ 3. Loot Card Presentation (Stats, narrative, coin reward, rarity border)
           │
           ▼
    🏰 4. Server-Authoritative Hoarding (Optional Phase 5 persistent save)
           • Supabase Auth JWT verification (`getUser(token)`)
           • Cryptographic tamper detection against server signature
           • PostgreSQL insert via user-scoped RLS client into `loot_items`
```

---

## ✨ Key Features

- **Mobile-First Dark Fantasy UI**: Atmospheric parchment, moss green, stone-gray tones, and rich rarity accents.
- **Client-Side Image Optimization**: Browser Canvas resizes high-res phone camera uploads to $\le$ 1024px max dimension before transmission, minimizing data usage and upload latency.
- **Deep Magic Byte Verification**: Server inspects buffer headers (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `RIFF...WEBP` for WebP) to reject spoofed files before touching the AI provider.
- **Creative AI Appraisals**: Uses an open-weight vision model via OpenRouter's OpenAI-compatible API to describe visual characteristics and invent playful lore.
- **Server-Authoritative Rarity & Balance**: The AI never decides stats or rarity. Rarity weights, stat budgets, and coin rewards are rolled and strictly capped by the backend loot engine.
- **Full-Payload Cryptographic Signing**: Server signs all narrative and numerical attributes with an HMAC SHA-256 token. Altering any coin, stat, rarity, or lore field fails signature verification on save.
- **Supabase Authentication**: Email/password sign-up, sign-in, session persistence, and password reset via Supabase Auth.
- **Persistent Treasury & User Isolation**: Authenticated hoarders can save appraised items to their personal inventory, browse their collection, and sort by date, coin value, or rarity.
- **Graceful Unconfigured Fallback**: If Supabase credentials are not supplied, the app runs seamlessly in guest appraisal mode without crashing or blocking users.
- **Deterministic Offline Fallbacks**: If the AI model times out or encounters network hurdles, the app automatically delivers a thematic fallback loot card (`source: "fallback"`).

---

## 🎲 The Rarity & Economy System

Every appraisal triggers a weighted server-side roll:

| Rarity | Weight | Stat Budget | Coin Value Range | Appearance Accent |
| :--- | :---: | :---: | :---: | :--- |
| **Common** | 45% | 4 – 7 pts | 5 – 15 🪙 | Muted Slate Gray |
| **Uncommon** | 28% | 8 – 12 pts | 16 – 40 🪙 | Forest Green |
| **Rare** | 16% | 13 – 18 pts | 41 – 100 🪙 | Arcane Blue |
| **Epic** | 8% | 19 – 25 pts | 101 – 250 🪙 | Regal Purple |
| **Legendary** | 3% | 26 – 35 pts | 251 – 500 🪙 | Radiant Gold Amber |

Stat attributes distribute points dynamically across `ATK`, `DEF`, `SPD`, `INT`, and `LUCK` up to the selected rarity budget.

---

## 🛠️ Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)              │
│  - Tailwind CSS dark fantasy theme                     │
│  - Canvas image resizer (lib/resizeImage.js)          │
│  - Supabase client listener & AuthModal                │
│  - Inventory treasury view & rarity filter             │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP /api/appraise & /api/inventory/save
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Backend (Express 5 on Node.js)       │
│  - In-memory Multer file validation + Magic Bytes      │
│  - OpenRouter Vision API (dots-studio/dots-3-note-preview)│
│  - Loot engine & budget generator (engine.js)         │
│  - Full payload HMAC-SHA256 signer (auth.js)           │
│  - Token-verified save endpoint (/api/inventory/save)  │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────────┐ ┌───────────────────────┐
│ OpenRouter Vision Model     │ │ Supabase (Auth & PG)  │
│ - Vision analysis            │ │ - JWT Auth (`getUser`)│
│ - Fictional item naming & lore│ │ - RLS User Isolation │
└──────────────────────────────┘ └───────────────────────┘
```

- **Frontend**: React 19, Vite 8, Tailwind CSS 4.
- **Backend**: Node.js 20+, Express 5, Multer, Zod 4, Express Rate Limit.
- **Inference**: OpenRouter OpenAI-compatible API (`dots-studio/dots-3-note-preview:free`).
- **Database & Auth**: Supabase (PostgreSQL 15+ with Row Level Security and GoTrue Auth).
- **Deployment**: Render Web Service (Single unified Node service serving the Express API and compiled Vite static frontend).

---

## 🏰 Phase 5: Authentication & Persistent Inventory

Phase 5 introduces accounts and persistent hoard management:

### Implemented Features
1. **User Authentication**:
   - Clean modal UI for Sign In, Sign Up, and Password Reset.
   - Session restoration and live state synchronization with `supabase.auth.onAuthStateChange`.
   - Automatic guest mode fallback when credentials are not configured.
2. **Server-Authoritative Save Flow**:
   - `POST /api/inventory/save` requires a valid Supabase `Bearer <token>`.
   - The server verifies the token against the Supabase Auth API using `getUser(token)`. The client-supplied user ID is never trusted.
   - The server recalculates and validates the HMAC-SHA256 signature across all canonical narrative and numerical fields (`id`, `createdAt`, `source`, `observed_object`, `confidence`, `name`, `item_type`, `rarity`, `goblin_value`, `stats`, `ability_name`, `ability_description`, `lore`, `appraisal`, `disclaimer`).
   - If any attribute has been altered, the server rejects the save with HTTP 403.
3. **Treasury (Inventory) Interface**:
   - Grid view displaying hoarded relics with card thumbnails.
   - Summary banner showing total items and accumulated Goblin Coins.
   - Filtering by rarity (`All`, `Legendary`, `Epic`, `Rare`, `Uncommon`, `Common`) and sorting by newest, value, or rarity.
   - Detailed single-item view with full RPG lore inspection.
4. **Database Security & Immutability**:
   - PostgreSQL schema with foreign key constraints and unique compound index `(user_id, item_id)`.
   - Row Level Security (RLS) ensures users can only read, insert, and delete items where `auth.uid() = user_id`.
   - Direct `UPDATE` permissions on `loot_items` are revoked from `anon` and `authenticated` roles. Hoarded stats, rarity, and coins are completely immutable once saved.

> [!NOTE]
> **Verification Status**: The Phase 5 frontend auth flow, backend API authorization checks, cryptographic tamper detection, and SQL migration syntax have been fully validated via local automated test suites. Applying the migration against your live Supabase project requires running `supabase/migrations/20261010000000_initial_schema.sql` in your Supabase SQL Editor.

---

## 🚀 Prerequisites & Quick Start

### Prerequisites
- **Node.js**: Version 20.x or higher (Node 22 LTS supported).
- **npm**: Version 10.x or higher.
- **OpenRouter API Key**: Obtain a free API key at [openrouter.ai](https://openrouter.ai/).
- **Supabase Account** *(Optional for local appraisal; required for inventory saving)*: Create a free project at [supabase.com](https://supabase.com/).

### 1. Clone Repository
```bash
git clone https://github.com/Gauthamkv14/irl-loot-goblin.git
cd irl-loot-goblin
```

### 2. Install Dependencies
Install dependencies across root, client, and server workspaces:
```bash
npm --prefix client install
npm --prefix server install
```

### 3. Configure Local Environment
Copy the example environment files:

**PowerShell (Windows)**:
```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

**Bash (macOS / Linux)**:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` and `client/.env` with your credentials (see [Environment Variables](#-environment-variables)).

### 4. Running the Application

#### Option A: Unified Production Build (Recommended)
Build the frontend and run the production Express server serving both the API and client assets:
```bash
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Option B: Local Development Mode (Hot Reload)
Start the backend API server in terminal 1:
```bash
npm run server:dev
```
*(Starts Express server with file watch on port 3000)*

Start the Vite development server in terminal 2:
```bash
npm run client:dev
```
*(Starts Vite dev server on port 5173 with automatic `/api` proxying to `http://localhost:3000`)*

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Environment Variables

The project separates client-exposed variables from private server secrets.

### Backend (`server/.env`)
| Variable | Required | Description |
| :--- | :---: | :--- |
| `PROVIDER_BASE_URL` | Yes | OpenRouter endpoint base URL. Default: `https://openrouter.ai/api/v1` |
| `PROVIDER_API_KEY` | Yes | Your private OpenRouter API key (`sk-or-v1-...`). |
| `MODEL_ID` | Yes | Vision model ID. Default: `dots-studio/dots-3-note-preview:free` |
| `PORT` | No | Server port (defaults to `3000` locally, injected dynamically by Render). |
| `LOOT_SIGNING_SECRET` | **Prod Only** | 64-character hex secret used for HMAC-SHA256 loot integrity signing. Must be at least 32 characters. Stable across deployments. |
| `SUPABASE_URL` | For Auth | Your Supabase project URL (e.g., `https://xyzproject.supabase.co`). |
| `SUPABASE_ANON_KEY` | For Auth | Your Supabase anon public key for server-side token validation. |

**Generating a secure `LOOT_SIGNING_SECRET`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend (`client/.env`)
| Variable | Required | Description |
| :--- | :---: | :--- |
| `VITE_SUPABASE_URL` | For Auth | Your Supabase project URL (e.g., `https://xyzproject.supabase.co`). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | For Auth | Your Supabase project anonymous/publishable key. |

> [!CAUTION]
> Never put `PROVIDER_API_KEY`, `LOOT_SIGNING_SECRET`, or Supabase service-role keys into `client/.env` or prefix them with `VITE_`. Client variables are baked into static JavaScript bundles and visible to all users.

---

## 🗄️ Database Setup (Supabase)

To enable user accounts, persistent inventory saving, quests, progression, leaderboards, and trading:

1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. In the Supabase Dashboard, navigate to **Project Settings $\rightarrow$ API**:
   - Copy **Project URL** into `SUPABASE_URL` and `VITE_SUPABASE_URL`.
   - Copy **Project API keys $\rightarrow$ anon / public** into `SUPABASE_ANON_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - Copy **Project API keys $\rightarrow$ service_role** into `SUPABASE_SERVICE_ROLE_KEY` in `server/.env` (server-side only!).
3. In **Project Settings $\rightarrow$ API $\rightarrow$ Extra search path / Exposed schemas**, add `goblin_internal`.
4. Navigate to **SQL Editor $\rightarrow$ New query** and execute the migrations in sequential order:
   - `supabase/migrations/20261010000000_initial_schema.sql` (Phase 5 base schema & profiles trigger)
   - `supabase/migrations/20261011000000_phase6_progression.sql` (Phase 6 base progression tables)
   - `supabase/migrations/20261011020000_private_rpc_security_remediation.sql` (Private schema `goblin_internal` & atomic progression RPC)
   - `supabase/migrations/20261011030000_phase7_leaderboards_and_trading.sql` (Phase 7 public profiles, leaderboard view, trade tables, and trading RPCs)

### Authentication URL Configuration
In **Authentication $\rightarrow$ URL Configuration**:
- **Site URL**:
  - Local testing: `http://localhost:5173` (or `http://localhost:3000` for production builds)
  - Production: `https://loot-goblin.onrender.com`
- **Redirect URLs**: Add both local and production URLs:
  - `http://localhost:5173/**`
  - `http://localhost:3000/**`
  - `https://loot-goblin.onrender.com/**`

---

## 🧪 Tests & Validation

The test suite covers algorithmic unit rules, live vision appraisals, HTTP contracts, security tamper protection, progression math, trading locks, and static serving:

```bash
# Run backend unit and live API integration tests
npm run test:server

# Run unit tests only (loot engine budget rules, Zod schemas, safety filters)
npm --prefix server run test:unit

# Run live API integration tests (image magic byte verification, OpenRouter vision)
npm --prefix server run test:api

# Run Phase 5 cryptographic signing and authorization tests
node server/test-security.js

# Run Phase 6 progression, daily quest determinism, and achievement tests
node server/test-progression.js

# Run Phase 7 trading, row lock ordering, and leaderboard security tests
node server/test-trading-and-leaderboards.js

# Run Supabase SQL migration schema & contract checks (Phases 5, 6, and 7)
node server/test-supabase-schema.js

# Run frontend/backend contract tests
node server/test-contract.js

# Verify unified production static hosting & SPA routing
node server/test-production-serve.js

# Full production compile test
npm run build
```

---

## 🌐 Render Deployment

LootGoblin deploys as a single Node.js Web Service on [Render](https://render.com), serving both the Express backend API and the static React production assets.

### Render Dashboard Settings
- **Service Type**: Web Service
- **Environment**: Node
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`

### Render Environment Variables
Add these in **Dashboard $\rightarrow$ Environment**:
1. `NODE_VERSION` = `20`
2. `PROVIDER_BASE_URL` = `https://openrouter.ai/api/v1`
3. `PROVIDER_API_KEY` = *your_openrouter_api_key*
4. `MODEL_ID` = `dots-studio/dots-3-note-preview:free`
5. `LOOT_SIGNING_SECRET` = *your_generated_32_byte_hex_secret*
6. `SUPABASE_URL` = *https://your-project.supabase.co*
7. `SUPABASE_ANON_KEY` = *your_supabase_anon_key*
8. `VITE_SUPABASE_URL` = *https://your-project.supabase.co*
9. `VITE_SUPABASE_PUBLISHABLE_KEY` = *your_supabase_anon_key*

> [!IMPORTANT]
> Keep `LOOT_SIGNING_SECRET` stable in Render's environment settings. If the secret is changed or rotated between redeployments, unhoarded cards appraised with the previous secret will fail signature validation.

For detailed deployment architecture, consult [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 🔧 Troubleshooting

### 1. "Authentication is currently disabled / Supabase Not Configured"
- **Cause**: `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is missing or contains placeholder values.
- **Fix**: Verify `client/.env` contains your active Supabase URL and public anon key, then restart Vite.

### 2. "FATAL: LOOT_SIGNING_SECRET must be configured in environment variables for production"
- **Cause**: `NODE_ENV=production` is set, but `LOOT_SIGNING_SECRET` is missing or fewer than 32 characters.
- **Fix**: Generate a 64-character hex secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and add it to your server environment.

### 3. "Tampering detected! Loot record does not match certified server appraisal"
- **Cause**: An attempt was made to save an item whose fields (rarity, stats, coins, name, lore) were modified, or the server's signing secret changed between appraisal and save.
- **Fix**: Ensure `LOOT_SIGNING_SECRET` remains constant across server restarts. Do not modify loot card properties before saving.

### 4. "Corrupted or spoofed image file"
- **Cause**: Uploaded file header bytes do not match standard JPEG, PNG, or WebP magic bytes.
- **Fix**: Ensure you are uploading a valid image file directly from a device or camera.

---

## 🛡️ Privacy, Security & Limitations

- **No Real World Geolocation Stored**: Photos are processed purely for visual feature extraction; EXIF GPS coordinates are stripped during client Canvas resizing.
- **Ephemeral Photo Storage**: Uploaded photo buffers exist only in server memory for the duration of the appraisal call. Full-size photos are never written to disk or database.
- **Thumbnail Optimization**: When saving items, the client sends a small, lightweight data URL thumbnail ($\le$ 100 KB) for inventory rendering.
- **Model Hallucinations**: Item appraisals are fictional game narratives created by an open-weight model. They do not constitute actual appraisals or material identification of real-world objects.

---

## 🛣️ Roadmap

- [x] Phase 1: Open-weight vision provider integration smoke test
- [x] Phase 2: Loot generation engine, rarity budgets, and Express API
- [x] Phase 3: Mobile-first dark fantasy UI, Canvas image resizer, and loot cards
- [x] Phase 4: Single-service production serving and Render deployment preparation
- [x] Phase 5: Supabase authentication, server-authoritative loot signing, and persistent treasury
- [ ] Phase 6: Daily exploration quests, scavenger hunts, and goblin achievements
- [ ] Phase 7: Public hoarder leaderboards and trading outpost

---

## 📄 License

This project is licensed under the terms of the MIT License. See [LICENSE.md](LICENSE.md) for details.

---

<p align="center">
  <strong>Go outside. Find something weird. Let the Goblin judge it.</strong><br />
  <em>Touch grass. Find loot. 👹</em>
</p>