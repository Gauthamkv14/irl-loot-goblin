import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import app without auto-starting server
process.env.NODE_ENV = 'test';
const { default: app } = await import('./index.js');

const PORT = 3008;
const server = app.listen(PORT);

console.log('--- Running Phase 4 Outdoor Loot Guardrails & Exploit Prevention Tests ---');

try {
  const baseUrl = `http://localhost:${PORT}`;

  // Helper to submit an image to /api/appraise
  async function submitImage(imageFilename, huntPrompt = null) {
    const imgPath = path.resolve(__dirname, 'test-images', imageFilename);
    const imgBuffer = fs.readFileSync(imgPath);
    const form = new FormData();
    const blob = new Blob([imgBuffer], { type: 'image/jpeg' });
    form.append('image', blob, imageFilename);
    if (huntPrompt) form.append('hunt', huntPrompt);

    const res = await fetch(`${baseUrl}/api/appraise`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  // 1. Outdoor Leaf (Must qualify)
  console.log('1. Testing outdoor leaf (leaf.jpg)...');
  const leafRes = await submitImage('leaf.jpg');
  assert.strictEqual(leafRes.status, 200, `Expected HTTP 200 for leaf.jpg, got ${leafRes.status}`);
  assert.strictEqual(leafRes.data.source, 'model');
  assert(leafRes.data.signature, 'Expected HMAC signature on valid outdoor leaf');
  assert(leafRes.data.goblin_value > 0, 'Expected positive coin reward');
  console.log(`✓ Accepted outdoor leaf: "${leafRes.data.name}" (${leafRes.data.goblin_value} coins, signed).`);

  // 2. Outdoor Pebbles (Must qualify)
  console.log('2. Testing outdoor pebbles (pebbles.jpg)...');
  const pebblesRes = await submitImage('pebbles.jpg');
  assert.strictEqual(pebblesRes.status, 200, `Expected HTTP 200 for pebbles.jpg, got ${pebblesRes.status}`);
  assert.strictEqual(pebblesRes.data.source, 'model');
  assert(pebblesRes.data.signature, 'Expected HMAC signature on valid outdoor pebbles');
  assert(pebblesRes.data.goblin_value > 0, 'Expected positive coin reward');
  console.log(`✓ Accepted outdoor pebbles: "${pebblesRes.data.name}" (${pebblesRes.data.goblin_value} coins, signed).`);

  // 3. Gaming Mouse on Desk (Must be rejected)
  console.log('3. Testing gaming mouse on desk (mouse.jpg)...');
  const mouseRes = await submitImage('mouse.jpg');
  assert.strictEqual(mouseRes.status, 422, `Expected HTTP 422 for mouse.jpg, got ${mouseRes.status}`);
  assert.strictEqual(mouseRes.data.code, 'INELIGIBLE_OBJECT');
  assert(!mouseRes.data.signature, 'Rejected item must NOT have an HMAC signature');
  assert(mouseRes.data.error, 'Expected goblin rejection message');
  console.log(`✓ Rejected gaming mouse: "${mouseRes.data.error}"`);

  // 4. Keyboard (Must be rejected)
  console.log('4. Testing keyboard (keyboard.jpg)...');
  const kbRes = await submitImage('keyboard.jpg');
  assert.strictEqual(kbRes.status, 422, `Expected HTTP 422 for keyboard.jpg, got ${kbRes.status}`);
  assert.strictEqual(kbRes.data.code, 'INELIGIBLE_OBJECT');
  assert(!kbRes.data.signature, 'Rejected item must NOT have an HMAC signature');
  console.log(`✓ Rejected keyboard: "${kbRes.data.error}"`);

  // 5. Leaf on Screen (Must be rejected)
  console.log('5. Testing leaf displayed on screen (leaf_on_screen.jpg)...');
  const screenRes = await submitImage('leaf_on_screen.jpg');
  assert.strictEqual(screenRes.status, 422, `Expected HTTP 422 for leaf_on_screen.jpg, got ${screenRes.status}`);
  assert.strictEqual(screenRes.data.code, 'INELIGIBLE_OBJECT');
  assert(!screenRes.data.signature, 'Rejected screen item must NOT have an HMAC signature');
  console.log(`✓ Rejected leaf on screen: "${screenRes.data.error}"`);

  // 6. Gaming Mouse Placed Outdoors (Must be rejected)
  console.log('6. Testing gaming mouse placed outdoors on grass (mouse_on_grass.jpg)...');
  const grassMouseRes = await submitImage('mouse_on_grass.jpg');
  assert.strictEqual(grassMouseRes.status, 422, `Expected HTTP 422 for mouse_on_grass.jpg, got ${grassMouseRes.status}`);
  assert.strictEqual(grassMouseRes.data.code, 'INELIGIBLE_OBJECT');
  assert(!grassMouseRes.data.signature, 'Rejected item must NOT have an HMAC signature');
  console.log(`✓ Rejected mouse on grass: "${grassMouseRes.data.error}"`);

  // 7. Ambiguous Indoor Plant / Illustration (Must be rejected)
  console.log('7. Testing indoor potted plant / illustration (indoor_plant.jpg)...');
  const plantRes = await submitImage('indoor_plant.jpg');
  assert.strictEqual(plantRes.status, 422, `Expected HTTP 422 for indoor_plant.jpg, got ${plantRes.status}`);
  assert.strictEqual(plantRes.data.code, 'INELIGIBLE_OBJECT');
  assert(!plantRes.data.signature, 'Rejected indoor plant must NOT have an HMAC signature');
  console.log(`✓ Rejected indoor plant: "${plantRes.data.error}"`);

  // 8. Forged inventory/reward submission
  console.log('8. Testing forged inventory submission with fabricated coins/signature...');
  const forgedItem = {
    id: 'item_fake_123',
    createdAt: new Date().toISOString(),
    source: 'model',
    observed_object: 'Gaming Mouse',
    confidence: 'high',
    name: 'Hacked Mouse of Wealth',
    item_type: 'Relic',
    rarity: 'Legendary',
    stats: { ATK: 99 },
    goblin_value: 99999,
    ability_name: 'Infinite Money',
    ability_description: 'Grants infinite coins',
    lore: 'Hacked item injected by client',
    appraisal: 'Totally real find',
    disclaimer: 'Certified Goblin Appraisal',
    signature: 'badc0ffeedeadbeef0123456789abcdef0123456789abcdef0123456789abcdef'
  };

  const fakeSaveRes = await fetch(`${baseUrl}/api/inventory/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer some.mock.jwt'
    },
    body: JSON.stringify({ item: forgedItem })
  });

  // Since JWT is fake, returns 401; if auth succeeded, signature check returns 403
  assert(fakeSaveRes.status === 401 || fakeSaveRes.status === 403, `Expected 401 or 403, got ${fakeSaveRes.status}`);
  console.log(`✓ Forged inventory submission safely blocked with HTTP ${fakeSaveRes.status}.`);

  console.log('\n🎉 ALL OUTDOOR LOOT GUARDRAIL & EXPLOIT TESTS PASSED SUCCESSFULLY!');
} finally {
  server.close();
}
