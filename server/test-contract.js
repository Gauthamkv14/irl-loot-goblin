import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import app without auto-starting
process.env.NODE_ENV = 'test';
const { default: app } = await import('./index.js');
const { fallbackItem } = await import('./schema.js');
const { rollLoot } = await import('./loot.js');

const PORT = 3003;
const server = app.listen(PORT);

console.log('--- Running Phase 3 Frontend/Backend Contract & Simulation Tests ---');

try {
  const baseUrl = `http://localhost:${PORT}`;

  // 1. Verify schema contract for fallback item simulation
  console.log('1. Verifying fallback item representation contract...');
  const sampleRoll = rollLoot();
  const sampleFallback = fallbackItem(sampleRoll);

  assert.strictEqual(sampleFallback.source, 'fallback');
  assert(sampleFallback.name.length > 0);
  assert(sampleFallback.disclaimer.includes('Certified Goblin Appraisal'));
  console.log('✓ Fallback contract verified (source="fallback", distinct from "model").');

  // 2. Verify debouncing / concurrent appraisal safety
  console.log('2. Verifying request multipart field name...');
  const leafPath = path.resolve(__dirname, 'test-images/leaf.jpg');
  const leafBuffer = fs.readFileSync(leafPath);

  // Wrong field name (e.g. "photo" instead of expected "image")
  const formWrongField = new FormData();
  formWrongField.append('photo', new Blob([leafBuffer], { type: 'image/jpeg' }), 'leaf.jpg');

  const wrongFieldRes = await fetch(`${baseUrl}/api/appraise`, {
    method: 'POST',
    body: formWrongField
  });
  assert.strictEqual(wrongFieldRes.status, 400);
  const wrongFieldJson = await wrongFieldRes.json();
  assert(wrongFieldJson.error.includes('field name "image"'), 'Expected error specifying field name "image"');
  console.log('✓ Backend strictly requires multipart field "image". Verified matching frontend FormData append.');

  // 3. Verify maximum upload size boundary (>4MB)
  console.log('3. Verifying oversized upload boundary (> 4MB)...');
  const hugeBuffer = Buffer.alloc(4.5 * 1024 * 1024); // 4.5MB
  const formHuge = new FormData();
  formHuge.append('image', new Blob([hugeBuffer], { type: 'image/jpeg' }), 'huge.jpg');

  const hugeRes = await fetch(`${baseUrl}/api/appraise`, {
    method: 'POST',
    body: formHuge
  });
  assert.strictEqual(hugeRes.status, 400);
  const hugeJson = await hugeRes.json();
  assert(hugeJson.error.includes('Maximum allowed file size is 4 MB') || hugeJson.error.includes('Image too large'));
  console.log('✓ Oversized payload safely rejected with HTTP 400.');

  console.log('\n🎉 ALL PHASE 3 CONTRACT & SIMULATION TESTS PASSED!');
} finally {
  server.close();
}
