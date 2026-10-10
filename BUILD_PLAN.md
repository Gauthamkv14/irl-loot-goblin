# BUILD_PLAN.md - IRL Loot Goblin Phased Implementation Plan

## 1. Architecture & Core User Journey Summary

### Architecture
- **Monorepo / Single Deployment Target**: Render Web Service running a Node.js 20+ Express server that hosts both `/api/*` endpoints and static frontend build assets (`client/dist`).
- **Server Responsibilities**:
  - Roll item rarity via weighted probabilities, calculate stat budgets across 2–3 attributes (`ATK`, `DEF`, `CHA`, `LUCK`, `WIT`, `STINK`), and assign Goblin Coin values.
  - Parse and validate incoming multipart image uploads via Multer in-memory storage (max 4MB, `image/jpeg|png|webp`).
  - Forward the image, server-rolled stats, and prompt to an OpenAI-compatible vision provider.
  - Parse output, validate with Zod, perform up to one repair retry if malformed, and fall back to a safe demo fallback item if the retry fails.
  - Rate limit requests (`express-rate-limit`) to safeguard provider quota.
- **Client Responsibilities**:
  - React + Vite + Tailwind CSS.
  - Capture/select outdoor photos, resize client-side to $\sim 1024\text{ px}$ JPEG before upload, and generate a $\sim 200\text{ px}$ thumbnail.
  - Render rich, humorous RPG Loot Cards with clear "Certified Appraisal" vs "Demo Fallback" badging and fictional item warnings.
  - Persist inventory metadata and small thumbnails in browser `localStorage`.
  - Provide a curated pool of static outdoor scavenger hunt prompts (10-minute hunt framing).

### Core User Journey
1. **The Hunt**: User opens the app, sees the 10-minute "Touch Grass" off-screen challenge, and generates an outdoor hunt prompt (e.g., *"Find something that looks like it survived three fantasy wars"*).
2. **The Encounter**: User explores outside, spots an object (leaf, twig, strange rock, discarded bottle cap), snaps a photo or picks from the gallery.
3. **The Appraisal**: Client resizes the image and uploads to `POST /api/appraise`. The goblin squinting loading state activates.
4. **The Loot Card**: Server rolls game rarity/stats, calls the vision model, validates grounded creative lore, and returns the finished item. The card reveals with a themed rarity glow.
5. **The Goblin Treasury**: User saves the item to `localStorage`, tracks accumulated Goblin Coins, and reviews their inventory.

---

## 2. Workspace Assessment

- **Existing Assets**:
  - [PROJECT_SPEC.md](file:///c:/Users/User/OneDrive/Desktop/Projects/irl-loot-goblin/PROJECT_SPEC.md): Revision 2 MVP specification.
  - [PROJECT_RULES.md](file:///c:/Users/User/OneDrive/Desktop/Projects/irl-loot-goblin/PROJECT_RULES.md): Engineering rules and constraints.
- **Missing / Needs Creation**:
  - `git init`, `.gitignore`, and `README.md`.
  - Root `package.json` for monorepo orchestration (`npm run build`, `npm start`).
  - `server/`: Express setup, `appraise.js`, `loot.js`, `prompt.js`, `schema.js`, `.env.example`, `.env`.
  - Test photos folder (15–20 outdoor test images for verification and prompt tuning).
  - Provider verification harness: `server/test-call.js`.
  - `client/`: React + Vite + Tailwind CSS scaffold, `resizeImage.js`, `storage.js`, `hunts.js`, components (`HuntCard`, `Uploader`, `LootCard`, `Inventory`, UI shell).

---

## 3. Phased Implementation Steps

### Phase 0: Workspace Setup & Provider Verification Pre-Flight
- **Goal**: Initialize environment, git tracking, test photo fixtures, and select model provider.
- **Actions**:
  - Initialize Git repository and add comprehensive `.gitignore` (ignoring `.env`, `node_modules`, `dist`, upload temp files).
  - Prepare test image directory with representative sample items (leaf, twig, stone, bottle cap, plus blurry/ambiguous images).
  - Confirm provider selection and API credentials.
- **Verification**: Git initialized cleanly; test image assets accessible.

### Phase 1: Prove the Provider (AI Sanity Check)
- **Goal**: Verify vision capability and latency on the chosen model endpoint before writing any UI.
- **Actions**:
  - Scaffold `server/` with `package.json` (`express`, `multer`, `zod`, `dotenv`, `express-rate-limit`).
  - Create `server/test-call.js` script to send base64 data URLs to provider's `/chat/completions`.
  - Run test calls against 3–5 sample photos.
- **Acceptance Criteria**: Endpoint returns grounded item text describing actual image contents without errors or image rejection.

### Phase 2: Loot Engine & Backend API Pipeline
- **Goal**: Build server-authoritative loot generator, Zod schemas, prompt engineering, repair retry, and Express endpoints.
- **Actions**:
  - Implement `server/loot.js`: weighted rarity roll, stat distribution, coin value generator.
  - Implement `server/schema.js`: Zod schema for structured output validation, safe fallback item generator (`fallbackItem()`).
  - Implement `server/prompt.js`: Goblin persona, grounding rules, safety constraints, few-shot examples.
  - Implement `server/appraise.js`: OpenAI-compatible caller, JSON fence cleaning, Zod validation, 1-attempt repair retry, and fallback fallback route.
  - Implement `server/index.js`: Express app, Multer memory storage (4MB max, MIME filtering), rate limiter, `/api/health`, `/api/appraise`, static file serving.
- **Acceptance Criteria**:
  - `GET /api/health` returns `{ ok: true }`.
  - `POST /api/appraise` returns valid JSON with merged server stats and model narrative.
  - Broken JSON / provider errors gracefully degrade to `source: "fallback"`.

### Phase 3: Frontend Vertical Slice (Photo $\rightarrow$ Appraisal $\rightarrow$ Loot Card)
- **Goal**: Implement camera capture/selection, client-side downscaling, API call, and responsive card presentation.
- **Actions**:
  - Scaffold `client/` using Vite + React + Tailwind CSS; configure `/api` proxy in `vite.config.js`.
  - Implement `client/src/lib/resizeImage.js`: 1024px max-edge JPEG blob + 200px thumbnail data URL generation.
  - Implement `Uploader.jsx`: mobile camera capture input (`capture="environment"`), drag/drop, gallery fallback, preview, and loading animation state.
  - Implement `LootCard.jsx`: item name, rarity badge & glow, stats grid, abilities, grounded lore, coin value, and explicit fallback/disclaimer tags.
- **Acceptance Criteria**:
  - Capturing or uploading an image successfully runs the appraisal flow and renders the card.
  - Downscaled payload is transmitted; loading and error retry states function properly.

### Phase 4: Full Deployment & Monorepo Configuration
- **Goal**: Ensure the project builds and runs from a single unified server command on Render.
- **Actions**:
  - Setup root `package.json` scripts:
    - `"build": "npm --prefix client install && npm --prefix client run build && npm --prefix server install"`
    - `"start": "node server/index.js"`
  - Verify server correctly serves `client/dist` when `NODE_ENV=production`.
  - Confirm `PORT` environment variable binding.
- **Acceptance Criteria**: Running `npm run build && npm start` locally serves the complete application on a single port with no CORS issues.

### Phase 5: Hunts, Local Inventory & Polish
- **Goal**: Complete the scavenger hunt loop, offline-tolerant storage, and responsive UI.
- **Actions**:
  - Implement `client/src/lib/hunts.js`: pool of 35+ outdoor hunt prompts with "Touch Grass" 10-minute guidance.
  - Implement `client/src/lib/storage.js`: wrapped `localStorage` methods for storing inventory metadata and 200px thumbnails with quota safety.
  - Implement `HuntCard.jsx` and `Inventory.jsx` (slot grid, rarity borders, Goblin Treasury coin total, delete action, empty states).
  - Add responsive styling pass (360px–430px mobile focus).
- **Acceptance Criteria**:
  - Items persist across page reload.
  - Goblin Treasury accumulates coins correctly.
  - Mobile UI displays cleanly without overflow or clipped elements.

### Phase 6: Edge Case Hardening & Validation
- **Goal**: Ensure rock-solid error handling, safety boundaries, and compliance.
- **Actions**:
  - Test oversized uploads (>4MB), invalid file types (PDF, text), blurry images.
  - Verify safety guardrails: prompt explicitly suppresses recommendations to touch, ingest, or take outdoor objects.
  - Verify rate limiting triggers HTTP 429 when abused.
  - Ensure zero credentials or raw image payloads are logged.
- **Acceptance Criteria**: All negative and edge cases fail gracefully with actionable user messages.

---

## 4. Key Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Provider Vision Incompatibility** | Catastrophic (Phase 1 failure) | Verify exact model endpoint with `server/test-call.js` before writing any UI; maintain backup provider/model configuration. |
| **Model Output Formatting Failure** | High (Broken cards) | Strip markdown code blocks, strict Zod schema validation, 1-shot repair retry, deterministic fallback item. |
| **Client LocalStorage Quota Exceeded** | Medium (Save errors) | Never store full photos; only store compressed 200px thumbnails; implement try/catch quota eviction. |
| **Render Cold Start / Latency** | Medium (Degraded UX) | Responsive loading states ("The goblin is squinting at it..."); `/api/health` warming endpoint. |
| **Harmful/Dangerous Outdoor Advice** | Critical (User safety) | Strict system prompt negative constraints (hands-off rule, no foraging/touching) + explicit disclaimer tags. |
