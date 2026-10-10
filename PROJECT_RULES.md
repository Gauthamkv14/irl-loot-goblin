# PROJECT_RULES.md - IRL Loot Goblin Mandatory Engineering Constraints

This document defines the binding architectural, security, and quality rules for the **IRL Loot Goblin** project. All code and modifications must adhere strictly to these principles.

---

## 1. Scope & Core Architecture

1. **Follow [PROJECT_SPEC.md](file:///c:/Users/User/OneDrive/Desktop/Projects/irl-loot-goblin/PROJECT_SPEC.md)**: Do not silently replace its architecture, alter design targets, or invent extraneous features.
2. **Project Structure**:
   - `server/`: Node.js (v20+) with Express.
   - `client/`: React, Vite, and Tailwind CSS.
   - Monorepo root `package.json` with unified `build` and `start` scripts.
3. **Target Deployment**: A single **Render Web Service** serving both the API (`/api/*`) and the statically built React frontend (`client/dist`), eliminating cross-origin CORS overhead.
4. **No Feature Creep**: Absolutely **no** user authentication, databases, multiplayer, GPS/geofencing, payments, or third-party web scrapers. Keep scope strictly focused on the core loop: *Photo Hunt $\rightarrow$ Vision AI Appraisal $\rightarrow$ Loot Card $\rightarrow$ Local Inventory*.

---

## 2. Server-Controlled Game Mechanics

1. **Server Controls Numbers & Rarity**:
   - The server rolls rarity based on weighted probabilities (Common: 45%, Uncommon: 28%, Rare: 16%, Epic: 8%, Legendary: 3%).
   - The server determines the total stat budget and splits it across randomly chosen stats (`ATK`, `DEF`, `CHA`, `LUCK`, `WIT`, `STINK`).
   - The server assigns Goblin Coin values within the rolled rarity range.
2. **AI Generates Narrative Only**:
   - The vision model receives the pre-rolled rarity, stats, and coin value.
   - The model is responsible strictly for creative grounding: item name, observed object description, item type, ability name/description, lore, and appraiser commentary.
   - The model must never invent or override server-determined game numbers.

---

## 3. AI Pipeline, Validation & Fallback

1. **Replaceable OpenAI-Compatible Provider**:
   - Connect via standard OpenAI-compatible endpoints (`/chat/completions`) configured with `PROVIDER_BASE_URL`, `PROVIDER_API_KEY`, and `MODEL_ID`.
2. **Verified Vision Support**:
   - Only select model endpoints verified to handle multimodal image inputs (base64 data URLs in content parts). Never assume vision capabilities based on model naming alone (e.g., Gemma text-only vs vision variants).
3. **Structured Validation & Resilience Pipeline**:
   - Request structured JSON (JSON/schema mode if supported by provider).
   - Strip markdown fences (` ```json `) defensively.
   - Validate with `zod` schema (strictly enforcing string length caps and field types).
   - If parsing or validation fails, execute exactly **one repair retry** prompting the model with its error.
   - If the retry fails, seamlessly return an explicitly labelled fallback item (`source: "fallback"`).
4. **Safety & Content Rules**:
   - The goblin appraiser must remain playful, whimsical, and non-cruel.
   - System instructions strictly forbid encouraging touching, consuming, collecting, or disturbing unfamiliar outdoor flora, fauna, fungi, or sharp/dangerous objects.
   - Fictional item disclaimer must be attached.

---

## 4. Image Upload & Client Optimization

1. **Client-Side Optimization**:
   - Rescale captured/selected photos client-side to $\sim 1024\text{ px}$ max edge JPEG (quality $\sim 0.8$) before transmission to minimize payload and provider latency.
   - Produce a $\sim 200\text{ px}$ thumbnail data URL in the client for local persistence.
2. **Server-Side Upload Handling**:
   - Multer memory storage only (`multer.memoryStorage()`); never buffer or write raw image files to server disk.
   - Maximum upload limit of 4MB.
   - Strict MIME-type validation accepting only `image/jpeg`, `image/png`, and `image/webp`. Reject others with HTTP 400.
3. **Rate Limiting**:
   - Protect endpoint quota with `express-rate-limit` (e.g., 10 requests per minute per IP).

---

## 5. Persistence & Storage Constraints

1. **Client `localStorage` Only**:
   - Persist inventory metadata (`id`, `createdAt`, `item`, `observed_object`, `thumbnail`, `source`).
   - **Never** store full-resolution images in `localStorage`.
   - Wrap all `localStorage` access in `try/catch` and gracefully handle quota errors (e.g., trimming stale thumbnails or alerting the user).

---

## 6. Security, Privacy & Logging

1. **No Key Leakage**:
   - Never expose API keys or server credentials in frontend code, client bundles, git commits, screenshots, or logs.
   - All external provider calls must proxy through the backend server.
2. **Clean Logging**:
   - Never log raw image payloads, base64 data URLs, or sensitive tokens to server console or stdout.
3. **Honest Capabilities**:
   - Do not claim "offline", "edge", or "local inference" if using hosted provider APIs. Accurately report pipeline behavior.

---

## 7. Code Quality & Agent Workflow

1. **Modular & Readable**:
   - Keep modules small, decoupled, and cleanly named (`loot.js`, `appraise.js`, `prompt.js`, `schema.js`).
2. **Explicit States**:
   - Support distinct and polished UI states: Loading, Empty, Error (with retry), Model Result, and Fallback Result.
3. **Phased Execution**:
   - Before executing code phases, declare the goal and changes.
   - Verify changes with real tests/commands and report results truthfully.
   - Do not perform destructive commands or overwrite existing assets without explicit instruction.
