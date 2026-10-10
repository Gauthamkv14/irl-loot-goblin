import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

process.env.NODE_ENV = 'test';
process.env.PORT = '3002';

const { default: app } = await import('./index.js');
const server = app.listen(3002);

try {
  const baseUrl = 'http://localhost:3002';
  
  // 1. Verify /api/health
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.strictEqual(healthJson.ok, true);
  console.log('✓ Production /api/health responds correctly:', healthJson);

  // 2. Verify frontend root serves index.html
  const rootRes = await fetch(`${baseUrl}/`);
  assert.strictEqual(rootRes.status, 200);
  const rootHtml = await rootRes.text();
  assert(rootHtml.includes('<!doctype html>'), 'Root did not serve index.html');
  assert(rootHtml.includes('/assets/index-'), 'Root did not link asset bundle');
  console.log('✓ Production static root serves built index.html.');

  // 3. Verify client assets are accessible
  const assetMatch = rootHtml.match(/src="(\/assets\/[^"]+)"/);
  if (assetMatch) {
    const assetRes = await fetch(`${baseUrl}${assetMatch[1]}`);
    assert.strictEqual(assetRes.status, 200);
    console.log('✓ Production JS asset loaded successfully:', assetMatch[1]);
  }

  // 4. Verify API 404 does not get swallowed by frontend fallback
  const nonExistentApi = await fetch(`${baseUrl}/api/nonexistent`);
  assert.strictEqual(nonExistentApi.status, 404);
  console.log('✓ /api/* 404 route is NOT swallowed by frontend static route.');

  // 5. Verify SPA deep links fallback to index.html
  const deepLink = await fetch(`${baseUrl}/item/curious-relic`);
  assert.strictEqual(deepLink.status, 200);
  const deepHtml = await deepLink.text();
  assert(deepHtml.includes('<!doctype html>'), 'Deep link did not return SPA index.html');
  console.log('✓ Deep link returns index.html for SPA routing.');

  console.log('\n🎉 ALL PRODUCTION SERVING CHECKS PASSED!');
} finally {
  server.close();
}
