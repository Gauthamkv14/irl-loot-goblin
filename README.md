# 👹 LootGoblin

<p align="center">
  <strong>Touch grass. Find loot.</strong><br />
  Turn the ordinary world into an extraordinary RPG adventure.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-MVP-f59e0b?style=for-the-badge" alt="MVP" />
  <img src="https://img.shields.io/badge/React-Vite-61dafb?style=for-the-badge&logo=react&logoColor=111827" alt="React + Vite" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js and Express" />
  <img src="https://img.shields.io/badge/AI-OpenRouter-7c3aed?style=for-the-badge" alt="OpenRouter" />
</p>

<p align="center">
  <a href="#-the-idea">The Idea</a> ·
  <a href="#-how-it-works">How It Works</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-tech-stack">Tech Stack</a> ·
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-roadmap">Roadmap</a>
</p>

---

## 🎒 The Idea

What if that random leaf on your walk was actually a **Legendary Nature Relic**?

LootGoblin is a real-world collectible RPG that turns ordinary objects into fictional game loot. Snap a picture of something you discover outdoors, let AI describe its imaginary powers, and see what kind of loot you've found.

A leaf becomes a relic. A pebble becomes a battle-worn artifact. A strangely shaped twig? Potentially an extremely questionable weapon.

The world is your loot table.

> **The golden rule:** Real-world exploration, fictional rewards. Leave what you find where it belongs.

## 🗺️ How It Works

1. **Explore** — Find an ordinary object during your day.
2. **Capture** — Upload or take a picture.
3. **Appraise** — AI generates a name, description, and RPG-style lore.
4. **Roll the loot** — The server assigns rarity, stats, and Goblin Coins.
5. **Admire your discovery** — See your generated loot card.

```text
       REAL WORLD
           │
           ▼
    📸 Capture an object
           │
           ▼
      🧠 AI appraisal
           │
           ▼
     🎲 Server-side roll
           │
           ▼
      ✨ YOUR LOOT!
    Name · Rarity · Stats
       Lore · Coins
```

## ✨ Features

| Feature | Description |
| --- | --- |
| 📷 Image capture | Upload an image or use a compatible mobile camera |
| 🧠 AI-generated loot | Turn visual descriptions into imaginative RPG items |
| 🎲 Rarity system | Roll for Common, Uncommon, Rare, Epic, or Legendary loot |
| ⚔️ RPG attributes | Generate fictional item stats within server-defined rules |
| 🪙 Goblin Coins | Earn an in-game currency roll for each appraisal |
| 📜 Loot cards | Display the generated item's identity, lore, rarity, and stats |
| 📱 Responsive UI | Explore the experience on desktop and mobile |
| 🛡️ Input validation | Validate uploaded images and enforce server-side limits |
| ⚡ Image optimization | Resize and compress images before uploading |

## 🎲 The Rarity System

Every appraisal has a chance of producing something better than the ordinary.

| Rarity | Roll weight |
| --- | ---: |
| Common | 45 |
| Uncommon | 28 |
| Rare | 16 |
| Epic | 8 |
| Legendary | 3 |

These weights total 100, giving Legendary loot a 3% chance under the configured weighted-roll system.

**Important:** AI generates the creative description; the backend controls the rarity and game mechanics. A model cannot simply declare every pebble Legendary.

## 🧠 AI at the Center

LootGoblin uses a vision-capable model through OpenRouter's OpenAI-compatible API.

The model contributes the creative side of the experience: interpreting the submitted image and generating imaginative loot details. The backend validates the response and applies the game's rules.

```text
React + Vite
     │
     ▼
Image resize & validation
     │
     ▼
Express API
     │
     ├── Validate upload
     ├── Request AI appraisal
     ├── Validate generated output
     └── Roll rarity, stats & coins
              │
              ▼
        Loot card response
              │
              ▼
          React UI
```

### A deliberate separation of responsibilities

- **AI:** Creative naming, descriptions, and RPG lore.
- **Backend:** Validation, rarity rolls, stat constraints, and coin rewards.
- **Frontend:** Image capture, upload feedback, loading states, and loot presentation.

The application uses a hosted inference provider, so image appraisal requires a working network connection and an available model endpoint.

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| AI inference | OpenRouter API |
| Validation | Zod and server-side upload checks |
| Image processing | Browser Canvas API |
| File uploads | Multer with in-memory storage |
| Testing | Node.js test scripts and production-build checks |
| Deployment | Render Web Service |

## 🚀 Quick Start

### Prerequisites

- Node.js 20
- npm
- An OpenRouter API key with access to the configured vision model

### 1. Clone the repository

```bash
git clone https://github.com/Gauthamkv14/irl-loot-goblin.git
cd irl-loot-goblin
```

### 2. Configure the backend

Create a local environment file:

**Windows PowerShell**
```powershell
Copy-Item server/.env.example server/.env
```

**macOS / Linux**
```bash
cp server/.env.example server/.env
```

Edit `server/.env` and enter your own OpenRouter API key.

```dotenv
PROVIDER_BASE_URL=https://openrouter.ai/api/v1
PROVIDER_API_KEY=your_openrouter_api_key_here
MODEL_ID=dots-studio/dots-3-note-preview:free
```

Keep `.env` files private. Never commit your API key to Git.

### 3. Install dependencies

From the repository root:

```bash
npm --prefix client install
npm --prefix server install
```

### 4. Start the application

Build the frontend and start the Express server:

```bash
npm run build
npm start
```

Open the local URL printed by the server, typically:

```text
http://localhost:3000
```

The production server serves both the API and the built frontend.

### Development

For frontend development, start the Vite development server:

```bash
npm --prefix client run dev
```

Run the Express backend in a separate terminal:

```bash
npm --prefix server start
```

The Vite development server proxies API requests to the backend.

## 🧪 Validation

The repository includes unit, API integration, contract, and production-serving tests.

Run the available checks from the repository root:

```bash
npm --prefix server test
npm --prefix server run test:api
npm --prefix server run test:contract
npm --prefix server run test:production
npm run build
```

These checks cover the backend's core behavior, API validation, frontend/backend contracts, and production serving.

## 🔐 Security & Reliability

- Uploaded images are size-limited and checked against supported image formats.
- The browser resizes images before upload to reduce payload size.
- The backend validates generated AI output rather than trusting it blindly.
- Rate limiting helps protect the appraisal endpoint from excessive requests.
- Provider failures and invalid responses are handled through bounded retries and fallback/error paths.
- API credentials are supplied through environment variables, not frontend code.

## 🛣️ Roadmap

LootGoblin is being built in small, testable stages.

- [x] AI-powered image appraisal
- [x] Server-controlled rarity and stat generation
- [x] Responsive loot-card interface
- [x] Upload validation and image optimization
- [x] Backend and production-build validation
- [ ] Deploy a public MVP
- [ ] Persistent personal loot inventory
- [ ] Scavenger hunts and discovery challenges
- [ ] Collection statistics and progression
- [ ] More item classes, effects, and loot-generation variations

Future features are planned, not part of the current MVP unless explicitly implemented.

## 🤝 Contributing

Ideas, bug reports, and contributions are welcome!

If you want to improve LootGoblin, consider working on:

- Better loot-generation prompts
- More balanced rarity and stat rules
- Accessible and responsive UI improvements
- Automated tests and error handling
- New exploration-oriented game mechanics

Please keep the core experience playful, safe, and honest about what the AI actually does.

## 📄 License

Add your chosen license before presenting the project as open source.

---

<p align="center">
  <strong>Go outside. Find something weird. Let the Goblin judge it.</strong><br />
  <em>Touch grass. Find loot. 👹</em>
</p>