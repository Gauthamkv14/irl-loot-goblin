import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import app without auto-starting server
process.env.NODE_ENV = 'test';
const { default: app } = await import('./index.js');

const PORT = 3001;
const server = app.listen(PORT);

console.log('--- Running Phase 2 Integration & API Endpoint Tests ---');

try {
  const baseUrl = `http://localhost:${PORT}`;

  // 1. Test GET /api/health
  console.log('1. Testing GET /api/health...');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.ok, true);
  console.log('✓ Health check passed:', healthData);

  // 2. Test POST /api/appraise without file (Expect HTTP 400)
  console.log('2. Testing POST /api/appraise without file...');
  const noFileRes = await fetch(`${baseUrl}/api/appraise`, {
    method: 'POST'
  });
  assert.strictEqual(noFileRes.status, 400);
  const noFileData = await noFileRes.json();
  assert(noFileData.error.includes('No image provided'), 'Expected missing image error message');
  console.log('✓ Rejected empty upload with HTTP 400.');

  // 3. Test POST /api/appraise with invalid file type (text file, Expect HTTP 400)
  console.log('3. Testing POST /api/appraise with invalid MIME type...');
  const formInvalid = new FormData();
  const dummyTextBlob = new Blob(['Hello world text'], { type: 'text/plain' });
  formInvalid.append('image', dummyTextBlob, 'test.txt');

  const invalidRes = await fetch(`${baseUrl}/api/appraise`, {
    method: 'POST',
    body: formInvalid
  });
  assert.strictEqual(invalidRes.status, 400);
  const invalidData = await invalidRes.json();
  assert(invalidData.error.includes('Invalid file type'), 'Expected invalid MIME type error');
  console.log('✓ Rejected text/plain upload with HTTP 400.');

  // 4. Test POST /api/appraise with spoofed MIME type (text content with image/jpeg header)
  console.log('4. Testing POST /api/appraise with spoofed MIME type...');
  const formSpoofed = new FormData();
  const fakeImageBlob = new Blob(['Not really a JPEG image file'], { type: 'image/jpeg' });
  formSpoofed.append('image', fakeImageBlob, 'spoofed.jpg');

  const spoofedRes = await fetch(`${baseUrl}/api/appraise`, {
    method: 'POST',
    body: formSpoofed
  });
  assert.strictEqual(spoofedRes.status, 400);
  const spoofedData = await spoofedRes.json();
  assert(spoofedData.error.includes('Header bytes do not match'), 'Expected magic byte mismatch error');
  console.log('✓ Rejected spoofed image header with HTTP 400.');

  // 5. Test POST /api/appraise with valid image (live appraisal or fallback verification)
  console.log('5. Testing POST /api/appraise with leaf.jpg...');
  const leafPath = path.resolve(__dirname, 'test-images/leaf.jpg');
  if (fs.existsSync(leafPath)) {
    const leafBuffer = fs.readFileSync(leafPath);
    const leafBlob = new Blob([leafBuffer], { type: 'image/jpeg' });
    const formValid = new FormData();
    formValid.append('image', leafBlob, 'leaf.jpg');
    formValid.append('hunt', 'Find something that looks like an ancient rune.');

    const start = Date.now();
    const appraiseRes = await fetch(`${baseUrl}/api/appraise`, {
      method: 'POST',
      body: formValid
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    assert.strictEqual(appraiseRes.status, 200);
    const lootCard = await appraiseRes.json();
    console.log(`✓ Received response in ${elapsed}s:`);
    console.log(`  - Source: ${lootCard.source}`);
    console.log(`  - Name: "${lootCard.name}"`);
    console.log(`  - Rarity: ${lootCard.rarity}`);
    console.log(`  - Stats:`, lootCard.stats);
    console.log(`  - Coins: ${lootCard.goblin_value}`);
    console.log(`  - Observed: "${lootCard.observed_object}"`);

    assert(lootCard.id, 'Missing item id');
    assert(lootCard.rarity, 'Missing item rarity');
    assert(lootCard.stats, 'Missing item stats');
    assert(lootCard.goblin_value >= 0, 'Invalid goblin value');
    assert(lootCard.source === 'model' || lootCard.source === 'fallback', 'Unknown source');
  }

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
} finally {
  server.close();
}
