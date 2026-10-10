# IRL Loot Goblin - Updated MVP Build Guide

*Revision 2: Render hosting, server-side loot rolls, hardened AI pipeline. Replaces the original spec's architecture and build plan; product goals, tone and safety rules stay as written.*

## 1. What changed from the original spec

| Area | Original | Now |
| --- | --- | --- |
| Hosting | Static host + small server | **Render Web Service** serving both API and built frontend (one deploy, no CORS) |
| Rarity, stats, value | Model decides | **Server rolls rarity with weighted odds**; stat budget and coin range derive from it; the model writes only the creative text |
| Photos | Uploaded as-is | **Resized client-side** to \~1024px JPEG before upload; \~200px thumbnail stored in localStorage |
| JSON handling | Validate, then fallback | Schema mode if available, strip fences, validate, **one repair retry**, then safe fallback item |
| Hunt prompts | Model-generated | **Static pool of 30–40 prompts** (AI hunts are a stretch goal) |
| Off-screen angle | Implicit | Explicit "10-minute hunt, phone in pocket, appraise afterwards" framing |
| Outdoor test | Hour 8 | **Done early** (end of Phase 3) |

## 2. Final stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite + Tailwind CSS | Fast scaffold, mobile-first utilities |
| Backend | Node.js 20+ with Express | Matches the spec's "small Node endpoint"; no serverless timeouts |
| Upload parsing | `multer` (memory storage) | Handles multipart images without writing to disk |
| Validation | `zod` | Schema validation of model output and requests |
| Rate limiting | `express-rate-limit` | Protects your provider quota from abuse |
| AI | Hosted vision-capable open-weight model (Gemma preferred; Qwen-VL or Llama vision as backup) via an OpenAI-compatible chat API | Swappable provider; image input as base64 data URL |
| Persistence | Browser `localStorage` | Inventory metadata + thumbnails only |
| Hosting | **Render Web Service** | One service, env-var secrets, GitHub auto-deploy |
| Share image (optional) | `html-to-image` | Turns the loot card into a PNG |

## 3. Repository layout

```text
loot-goblin/
├── server/
│   ├── index.js          # Express app, static serving, routes
│   ├── appraise.js       # provider call + retry + validation
│   ├── loot.js           # rarity roll, stat budget, coin range
│   ├── prompt.js         # system prompt + few-shot examples
│   ├── schema.js         # zod schemas, fallback item
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/   # HuntCard, Uploader, LootCard, Inventory
│   │   ├── lib/          # resizeImage.js, storage.js, hunts.js
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── package.json          # root scripts: build, start, dev
└── README.md
```

## 4. Phase-by-phase build instructions

### Phase 0 - Prep (30 minutes)

**Do:**

1. Check the challenge page for deadline, judging criteria and submission format (write-up, repo, demo, any agent-session embed).
2. Create a GitHub repo `loot-goblin` (public; Hacktoberfest-friendly, add a README and MIT licence).
3. Pick your inference provider. Confirm for the exact model ID: **image input supported**, rate limits, pricing/free tier, and terms. Do not assume any Gemma endpoint supports vision.
4. Create an API key and keep it out of Git.
5. Collect **15–20 test photos** now: twigs, leaves, stones, bottle caps, benches, puddles, odd signs, plus a few blurry, dark and ambiguous ones.

**Use:** GitHub, provider dashboard, your phone camera.

**Done when:** you have a model ID that accepts images, a key, and a folder of test photos.

### Phase 1 - Prove the provider (45–60 minutes). Do this before any UI.

**Do:**

1. `mkdir loot-goblin && cd loot-goblin && npm init -y`, then create `server/`.
2. In `server/`: `npm i express multer zod express-rate-limit dotenv`.
3. Create `server/.env` (git-ignored): `PROVIDER_API_KEY=...`, `PROVIDER_BASE_URL=...`, `MODEL_ID=...`.
4. Write a throwaway script `server/test-call.js` that reads one test photo, converts it to a base64 data URL, and POSTs to the provider's `/chat/completions` with a `messages` array containing a text part and an `image_url` part.
5. Run it on 5 photos. Record latency, whether images are accepted, and how the output reads.

**Use:** Node's built-in `fetch`, `fs.readFileSync`, the provider's docs.

**Done when:** a real photo goes in and sensible text about the photo comes out. If rate limits or vision support fail, switch to your backup model now, not later.

### Phase 2 - Loot engine and AI pipeline (1.5–2 hours)

**2a. Rarity and numbers (`server/loot.js`)**

Roll in code, not in the model.

| Rarity | Weight | Stat budget (sum of 2–3 stats) | Goblin Coin range |
| --- | --- | --- | --- |
| Common | 45 | 3–6 | 1–10 |
| Uncommon | 28 | 6–10 | 10–40 |
| Rare | 16 | 10–15 | 40–150 |
| Epic | 8 | 15–22 | 150–600 |
| Legendary | 3 | 22–30 | 600–2000 |

Tune these freely. Implementation: pick a rarity with a weighted random, pick a stat budget and coin value inside the ranges, then split the budget across 2–3 stat names (ATK, DEF, CHA, LUCK, WIT, STINK) randomly. Make one function `rollLoot()` that returns `{rarity, stats, goblin_value}`.

**2b. Prompt (`server/prompt.js`)**

System prompt should say:

- You are an overconfident goblin appraiser. Playful, dramatic, never cruel.
- First describe only what is **visibly** in the image; if ambiguous, say so with `confidence: low`.
- Then write the item **using the rarity, stats and value provided to you**; do not change them.
- Tie the joke to at least one visible trait.
- Never encourage touching unknown plants, fungi, animals, sharp or dirty objects, and never suggest taking or removing things.
- Avoid reusing naming patterns: no "The \_\_\_ of Unfinished Business", vary structure ("Leaf of…", "Mildly Cursed…", a person-style title, etc.).
- Return **only** JSON matching the schema.
- Include 3–4 few-shot examples covering different object types, one of them low-confidence.

The user message contains the image, the rolled rarity/stats/value, and the optional hunt prompt.

**2c. Schema (`server/schema.js`)**

Use the original suggested JSON schema, minus fields the server now controls. The model returns `observed_object` plus `name`, `item_type`, `ability_name`, `ability_description`, `lore`, `appraisal`. The server merges in `rarity`, `stats` and `goblin_value` from `rollLoot()`. Validate with zod: string length caps (name ≤ 60, lore ≤ 280, etc.), non-empty required fields, `confidence` in `low|medium|high`. Also export a `fallbackItem(roll)` that returns a generic, clearly labelled item ("Mysterious Thing, appraiser unavailable").

**2d. Appraise function (`server/appraise.js`)**

1. Roll loot.
2. Call the provider with the image, prompt and roll. Set a timeout (e.g. 45 s with `AbortController`) and `temperature` around 0.9.
3. If the provider supports JSON/schema mode, enable it.
4. Strip code fences, `JSON.parse`, validate with zod.
5. On failure, retry **once** with a short "Your last output was invalid JSON; return only corrected JSON" message that includes the bad output.
6. On second failure, return `fallbackItem` with `source: "fallback"`.
7. Always return `source: "model"` or `"fallback"` so the UI can label honestly.

**2e. Endpoint (`server/index.js`)**

- `POST /api/appraise`: `multer` memory storage with a 4 MB limit; accept only `image/jpeg`, `image/png`, `image/webp`; reject others with a clear 400. Optional `hunt` text field (cap its length). Apply `express-rate-limit` (e.g. 10 requests per minute per IP). Never log image bytes or the key.
- `GET /api/health`: returns `{ok:true}` (useful for warming Render and uptime pings).
- Static serving: `app.use(express.static('../client/dist'))` plus a catch-all returning `index.html`.

**Use:** Express, multer, zod, express-rate-limit, curl or Postman for testing.

**Prompt iteration loop:** run all 15–20 test photos through `appraise.js` and read the results. Fix the prompt until at least \~80% make you laugh and none are unsafe or wrong-footed. This is where most of the project's quality comes from, so budget real time for it.

**Done when:** `curl -F image=@twig.jpg localhost:3000/api/appraise` returns valid, funny, validated JSON, and a broken-JSON case returns the fallback.

### Phase 3 - First vertical slice in the UI (1.5 hours)

Build only: **pick photo → resize → call API → render one loot card.**

**Do:**

1. In the root: `npm create vite@latest client -- --template react`, then in `client/`: `npm i`, `npm i -D tailwindcss @tailwindcss/vite` and enable the plugin in `vite.config.js`.
2. In `vite.config.js` add a dev proxy: `server.proxy = { '/api': 'http://localhost:3000' }`.
3. `lib/resizeImage.js`: load the file into an `Image` (or `createImageBitmap`), draw to a canvas with the long edge at 1024px, export `canvas.toBlob(..., 'image/jpeg', 0.8)`. Also produce a 200px thumbnail data URL for storage.
4. `Uploader`: `<input type="file" accept="image/*" capture="environment">` so phones open the camera, with gallery selection as the fallback. Show a preview, a loading state ("The goblin is squinting at it…") and an error state with retry.
5. `LootCard`: photo on one side, item identity on the other, rarity colour treatment, stats, ability, lore, value, a "Certified Appraisal" label, and a "Market Value (Imaginary)" label. Show a small "Demo fallback" badge if `source === 'fallback'`.
6. One reveal animation only (CSS: scale/fade plus a rarity glow).

**Use:** React state, `fetch` with `FormData`, Tailwind.

**Done when:** on your phone (via local network or a tunnel) you can photograph an object and see a loot card.

**Then: run the outdoor test now.** Walk outside for 10 minutes, phone in your pocket, photograph 5–8 real finds, and note what the model got right, funny, or wrong. Screenshot everything. Fix prompt problems before building more.

### Phase 4 - Deploy to Render early (45 minutes)

Deploy the slice now so deployment problems surface early.

**Root `package.json` scripts:**

```json
{
  "scripts": {
    "build": "npm --prefix client install && npm --prefix client run build && npm --prefix server install",
    "start": "node server/index.js"
  }
}
```

**Render setup:**

1. Render dashboard → New → **Web Service** → connect the GitHub repo.
2. Runtime: Node. Build command: `npm run build`. Start command: `npm start`.
3. Environment variables: `PROVIDER_API_KEY`, `PROVIDER_BASE_URL`, `MODEL_ID`, `NODE_VERSION` (e.g. 20).
4. Make sure the server listens on `process.env.PORT`.
5. Enable auto-deploy on push.
6. Test `/api/health`, then a real photo from your phone on the live URL.

**Free-tier cold starts:** a free web service can sleep after inactivity and take tens of seconds to wake. Before recording the demo or sharing the link, open `/api/health` a minute ahead. Optionally use a free uptime pinger against `/api/health`. Check Render's current free-tier terms, since they change.

**Done when:** the live URL works end-to-end from your phone and the key appears nowhere in the client bundle or Git history.

### Phase 5 - Hunts, inventory and polish (2 hours)

**Do:**

1. `lib/hunts.js`: an array of 30–40 short prompts ("Find something that looks like it survived three fantasy wars."). Add a "Generate a Hunt" button that picks one randomly, avoiding immediate repeats. Include the 10-minute, phone-in-pocket framing on the landing screen.
2. `lib/storage.js`: wrap localStorage in try/catch; store an array of `{id, createdAt, item, observed_object, thumbnail, source}`. Handle quota errors by dropping the oldest thumbnails or warning the user. Never store full-size photos.
3. "Add to inventory" button on the loot card; save, then show a confirmation.
4. `Inventory` view: slot-style grid (thumbnail + rarity border), item count, total Goblin Coins ("Goblin Treasury"), tap a slot to reopen the card, empty state ("Your pockets contain only disappointment."), and a delete button per item.
5. Landing copy: the one-line premise, the fictional-content note, and the safety line (observe and photograph; don't collect, disturb wildlife, or enter restricted places).
6. Responsive pass at 360–430px width; check contrast on rarity colours.

**Use:** React state, localStorage, Tailwind.

**Done when:** you can collect several items, refresh the page, and still see them.

### Phase 6 - Hardening (1 hour)

- Error states: network failure, timeout, 400 on bad file type, 429 rate limit, provider error. Each gets a friendly message and a retry.
- Test: huge file, non-image file, blurry/dark photo, photo of a person, screenshot, photo of a plant or insect (the item text should stay hands-off and non-identifying).
- Confirm the fallback item path works when you deliberately break the provider key.
- Confirm no image or key appears in server logs.

### Phase 7 - Nice-to-haves (only if Phases 1–6 are done)

In this order:

1. **Download loot card** with `html-to-image` (`toPng` on the card element).
2. **Rarity distribution** bar in the inventory.
3. **Collection titles** computed from item count and rarities ("Certified Outdoor Goblin" at 5 items, and so on).
4. **Re-appraise** with a constraint: a second endpoint call that sends the existing `observed_object` (no new image) plus the constraint and the same roll.

Cut in reverse order if time is short.

### Phase 8 - Demo and write-up (1–1.5 hours)

**Demo (60–90 s, use a real outdoor capture):** premise line → show a hunt → photograph an object outdoors → reveal → read the name and one absurd ability → add to inventory and show the count and coins → "Touch grass. Loot acquired." If a provider failure forces a sample item, label it a fallback.

**Write-up sections:** Problem, Approach, Why open-weight AI (state only what you actually tested: model swap, prompt control, hosted inference; local run only if you really did it), Implementation (architecture diagram, server-side loot roll, validation and retry, localStorage), Outdoor test (what you photographed, hits and misses), Limitations (latency, rate limits, model errors, cold starts, fictional stats), Build proof (screenshots, demo video, repo link, session recording if offered).

Do not claim "fully local", "offline" or "privacy-preserving inference" unless that is true.

## 5. Time budget (about 10–11 hours with the added hardening)

| Phase | Time |
| --- | --- |
| 0 Prep | 0.5 h |
| 1 Prove provider | 1 h |
| 2 Loot engine and AI pipeline | 2 h |
| 3 UI slice and outdoor test | 2 h |
| 4 Render deploy | 0.75 h |
| 5 Hunts, inventory, polish | 2 h |
| 6 Hardening | 1 h |
| 7 Nice-to-haves | optional |
| 8 Demo and write-up | 1.5 h |

If the day is genuinely 8 hours, drop Phase 7 entirely, shorten Phase 6 to the fallback and error-state checks, and keep Phase 3's outdoor test.

## 6. Revised definition of done

- [ ] Live Render URL opens and works on a phone.
- [ ] Camera or gallery photo is resized client-side and sent to the server endpoint.
- [ ] Server rolls rarity, stats and value; the vision-capable open-weight model writes the item text.
- [ ] Output is validated; one repair retry; labelled fallback if it still fails.
- [ ] Loot card shows the photo, observed description, and fictional item with the fictional-content label.
- [ ] Items persist in localStorage across refreshes, with item count and Goblin Coin total.
- [ ] Errors, loading and empty states all handled.
- [ ] API key is only in Render environment variables.
- [ ] At least one real outdoor test documented with screenshots.
- [ ] Write-up accurately describes the model's role and the limitations.

## 7. Key risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Provider lacks vision or has tight limits | Prove it in Phase 1; keep a backup model ID |
| Model returns bad JSON | Schema mode, fence stripping, zod, one retry, fallback |
| Jokes are generic | Few-shot examples, visible-trait rule, anti-pattern rule, 15–20 photo test set |
| Render cold start during demo | Warm `/api/health` before recording |
| localStorage quota | Thumbnails only (\~200px), handle quota errors |
| Unsafe suggestions in lore | Prompt rules plus a quick keyword check for "touch", "eat", "pick up" in output, falling back if it trips |
