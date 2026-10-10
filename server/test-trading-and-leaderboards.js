import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- Running Phase 7 Trading & Leaderboard Security & Contract Tests ---');

// 1. Verify Leaderboard SQL View Excludes Private Profiles & Sensitive Fields
console.log('1. Verifying public leaderboard projection security...');
const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261011030000_phase7_leaderboards_and_trading.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

// The view must select from profiles & progression
assert(sql.includes('CREATE OR REPLACE VIEW public.public_leaderboard_view'), 'Leaderboard view definition missing');
// Strictly filter WHERE p.is_public = true
assert(sql.includes('WHERE p.is_public = true'), 'Leaderboard view MUST filter WHERE p.is_public = true');

// Ensure email is not included in the view projection
const viewDeclaration = sql.substring(sql.indexOf('CREATE OR REPLACE VIEW public.public_leaderboard_view'), sql.indexOf('CREATE OR REPLACE FUNCTION goblin_internal.execute_trade_atomic'));
assert(!viewDeclaration.includes('email'), 'Email address must NEVER be exposed in public_leaderboard_view');
assert(!viewDeclaration.includes('auth.users'), 'Direct auth.users reference must not be exposed in view');
console.log('✓ Public leaderboard view enforces opt-in filtering and exposes no email or private auth columns.');

// 2. Verify Trade Offers Constraints & Row Locking
console.log('2. Verifying trade offer constraints & race condition defenses...');
assert(sql.includes('idx_unique_active_item_trade'), 'Duplicate listing partial index missing');
assert(sql.includes("WHERE status = 'open'"), 'Active item unique index must target open status');

// Deadlock protection: Check that row locking is ordered deterministically
assert(sql.includes('IF v_offer.sender_item_id < p_caller_item_id THEN'), 'Lock comparison ordering missing');
assert(sql.includes('SELECT * INTO v_sender_item FROM public.loot_items WHERE user_id = v_offer.sender_id AND item_id = v_offer.sender_item_id FOR UPDATE;'), 'Sender item FOR UPDATE lock missing');
assert(sql.includes('SELECT * INTO v_caller_item FROM public.loot_items WHERE user_id = p_caller_id AND item_id = p_caller_item_id FOR UPDATE;'), 'Caller item FOR UPDATE lock missing');
console.log('✓ Trade execution acquires row locks in deterministic lexicographical order to prevent deadlocks.');

// Self-trade prevention
assert(sql.includes('IF v_offer.sender_id = p_caller_id THEN'), 'Self-trade check missing');
assert(sql.includes("Cannot trade with yourself"), 'Self-trade error message missing');
console.log('✓ Self-trading is rejected in execute_trade_atomic.');

// Status checks
assert(sql.includes("IF v_offer.status <> 'open' THEN"), 'Open status validation missing in execute_trade_atomic');
assert(sql.includes("Offer is no longer open"), 'Invalid offer status rejection missing');
console.log('✓ Non-open offers are rejected in execute_trade_atomic.');

// 3. Verify RPC Privileges & Defense-in-Depth
console.log('3. Verifying RPC execution privileges...');
assert(sql.includes('REVOKE EXECUTE ON FUNCTION goblin_internal.execute_trade_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;'), 'Direct client execution on execute_trade_atomic must be revoked');
assert(sql.includes('GRANT EXECUTE ON FUNCTION goblin_internal.execute_trade_atomic(UUID, UUID, TEXT) TO service_role;'), 'execute_trade_atomic must only be granted to service_role');

assert(sql.includes('REVOKE EXECUTE ON FUNCTION goblin_internal.cancel_trade_atomic(UUID, UUID) FROM PUBLIC, anon, authenticated;'), 'Direct client execution on cancel_trade_atomic must be revoked');
assert(sql.includes('GRANT EXECUTE ON FUNCTION goblin_internal.cancel_trade_atomic(UUID, UUID) TO service_role;'), 'cancel_trade_atomic must only be granted to service_role');
console.log('✓ Trading RPCs are locked to service_role and completely shielded from anon/authenticated clients.');

// 4. Verify Server Endpoints Input Sanitization & Authentication Validation
console.log('4. Verifying server-side trade endpoint validation logic in server/index.js...');
const serverIndexPath = path.resolve(__dirname, './index.js');
const serverIndex = fs.readFileSync(serverIndexPath, 'utf8');

// Endpoints exist
assert(serverIndex.includes("app.post('/api/profile/privacy'"), 'Privacy update route missing');
assert(serverIndex.includes("app.get('/api/leaderboards'"), 'Leaderboards route missing');
assert(serverIndex.includes("app.get('/api/trades/offers'"), 'Get trade offers route missing');
assert(serverIndex.includes("app.post('/api/trades/offers'"), 'Create trade offer route missing');
assert(serverIndex.includes("app.post('/api/trades/execute'"), 'Execute trade route missing');
assert(serverIndex.includes("app.post('/api/trades/cancel'"), 'Cancel trade route missing');

// Service role client usage for RPC
assert(serverIndex.includes("db: { schema: 'goblin_internal' }"), 'Server must target goblin_internal schema with service_role client');
assert(serverIndex.includes("execute_trade_atomic"), 'Server calls execute_trade_atomic');
assert(serverIndex.includes("cancel_trade_atomic"), 'Server calls cancel_trade_atomic');

// Ownership checks before offer creation
assert(serverIndex.includes(".from('loot_items')"), 'Server validates loot ownership');
assert(serverIndex.includes(".eq('user_id', user.id)"), 'Server scopes loot check to authenticated user');

// Market open offers safe column projection check
assert(serverIndex.includes(".select('id, sender_id, sender_item_id, sender_item_name, sender_item_rarity, sender_item_thumbnail, wanted_description, status, created_at')"), 'Server must select only safe open offer columns');
assert(serverIndex.includes(".eq('status', 'open')"), 'Server must explicitly filter to open offers');

console.log('✓ Server-side endpoint security, ownership verification, and service-role internal RPC calls verified.');

console.log('\n🎉 ALL PHASE 7 TRADING & LEADERBOARD SECURITY TESTS PASSED!');
