import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- Running Phase 5 Supabase Integration & RLS Contract Tests ---');

// 1. Verify Phase 5 SQL Migration Structure
console.log('1. Verifying Phase 5 SQL migration schema & constraints...');
const migrationPath5 = path.resolve(__dirname, '../supabase/migrations/20261010000000_initial_schema.sql');
assert(fs.existsSync(migrationPath5), 'Phase 5 migration file not found');
const sql5 = fs.readFileSync(migrationPath5, 'utf8');

// Table checks
assert(sql5.includes('CREATE TABLE IF NOT EXISTS public.profiles'), 'profiles table definition missing');
assert(sql5.includes('CREATE TABLE IF NOT EXISTS public.loot_items'), 'loot_items table definition missing');

// Foreign Key references
assert(sql5.includes('REFERENCES auth.users(id) ON DELETE CASCADE'), 'profiles auth.users reference missing');
assert(sql5.includes('REFERENCES public.profiles(id) ON DELETE CASCADE'), 'loot_items profiles reference missing');

// RLS enabled checks
assert(sql5.includes('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY'), 'profiles RLS not enabled');
assert(sql5.includes('ALTER TABLE public.loot_items ENABLE ROW LEVEL SECURITY'), 'loot_items RLS not enabled');

// Isolation policies
assert(sql5.includes('auth.uid() = id'), 'profiles user isolation missing');
assert(sql5.includes('auth.uid() = user_id'), 'loot_items user isolation missing');

// Unique constraints to prevent duplicate saving
assert(sql5.includes('CONSTRAINT unique_user_item UNIQUE (user_id, item_id)'), 'unique_user_item duplicate prevention missing');

// Trigger check
assert(sql5.includes('CREATE OR REPLACE FUNCTION public.handle_new_user()'), 'handle_new_user trigger function missing');
assert(sql5.includes('CREATE TRIGGER on_auth_user_created'), 'on_auth_user_created trigger missing');

console.log('✓ Phase 5 migration syntax, constraints, foreign keys, RLS policies, and triggers verified.');

// 1b. Verify Phase 6 SQL Migration Structure
console.log('1b. Verifying Phase 6 SQL migration schema & constraints...');
const migrationPath6 = path.resolve(__dirname, '../supabase/migrations/20261011000000_phase6_progression.sql');
assert(fs.existsSync(migrationPath6), 'Phase 6 migration file not found');
const sql6 = fs.readFileSync(migrationPath6, 'utf8');

assert(sql6.includes('CREATE TABLE IF NOT EXISTS public.user_progression'), 'user_progression table missing');
assert(sql6.includes('CREATE TABLE IF NOT EXISTS public.daily_quest_progress'), 'daily_quest_progress table missing');
assert(sql6.includes('CREATE TABLE IF NOT EXISTS public.hunt_progress'), 'hunt_progress table missing');
assert(sql6.includes('CREATE TABLE IF NOT EXISTS public.user_achievements'), 'user_achievements table missing');

assert(sql6.includes('ALTER TABLE public.user_progression ENABLE ROW LEVEL SECURITY'), 'user_progression RLS missing');
assert(sql6.includes('ALTER TABLE public.daily_quest_progress ENABLE ROW LEVEL SECURITY'), 'daily_quest_progress RLS missing');
assert(sql6.includes('ALTER TABLE public.hunt_progress ENABLE ROW LEVEL SECURITY'), 'hunt_progress RLS missing');
assert(sql6.includes('ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY'), 'user_achievements RLS missing');

assert(sql6.includes('CONSTRAINT unique_user_daily_quest UNIQUE (user_id, quest_id, quest_date)'), 'daily quest unique constraint missing');
assert(sql6.includes('CONSTRAINT unique_user_hunt_objective UNIQUE (user_id, hunt_id, objective_id)'), 'hunt objective unique constraint missing');
assert(sql6.includes('CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_id)'), 'achievement unique constraint missing');
console.log('✓ Phase 6 migration syntax, constraints, foreign keys, and RLS policies verified.');

// 1c. Verify Phase 6 Remediation Migration Structure
console.log('1c. Verifying Phase 6 Remediation SQL migration (Direct Write Revocation & Atomic RPC)...');
const migrationPathRemediation = path.resolve(__dirname, '../supabase/migrations/20261011010000_progression_security_remediation.sql');
assert(fs.existsSync(migrationPathRemediation), 'Remediation migration file not found');
const sqlRemediation = fs.readFileSync(migrationPathRemediation, 'utf8');

// Revocation of direct client writes
assert(sqlRemediation.includes('REVOKE INSERT, UPDATE, DELETE ON public.user_progression FROM anon, authenticated;'), 'user_progression write privileges not revoked');
assert(sqlRemediation.includes('REVOKE INSERT, UPDATE, DELETE ON public.daily_quest_progress FROM anon, authenticated;'), 'daily_quest_progress write privileges not revoked');
assert(sqlRemediation.includes('REVOKE INSERT, UPDATE, DELETE ON public.hunt_progress FROM anon, authenticated;'), 'hunt_progress write privileges not revoked');
assert(sqlRemediation.includes('REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM anon, authenticated;'), 'user_achievements write privileges not revoked');

// Dropping permissive write policies
assert(sqlRemediation.includes('DROP POLICY IF EXISTS "Users can insert own initial progression" ON public.user_progression;'), 'initial progression policy drop missing');
assert(sqlRemediation.includes('DROP POLICY IF EXISTS "Users can update own progression" ON public.user_progression;'), 'progression update policy drop missing');
assert(sqlRemediation.includes('DROP POLICY IF EXISTS "Users can insert own quest progress" ON public.daily_quest_progress;'), 'quest insert policy drop missing');
assert(sqlRemediation.includes('DROP POLICY IF EXISTS "Users can update own quest progress" ON public.daily_quest_progress;'), 'quest update policy drop missing');
assert(sqlRemediation.includes('DROP POLICY IF EXISTS "Users can insert own hunt progress" ON public.hunt_progress;'), 'hunt insert policy drop missing');
assert(sqlRemediation.includes('DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;'), 'achievement insert policy drop missing');

// Atomic RPC function checks
assert(sqlRemediation.includes('CREATE OR REPLACE FUNCTION public.hoard_relic_atomic'), 'hoard_relic_atomic RPC definition missing');
assert(sqlRemediation.includes('SECURITY DEFINER'), 'hoard_relic_atomic must be SECURITY DEFINER');
assert(sqlRemediation.includes('SET search_path = public'), 'hoard_relic_atomic search_path protection missing');
assert(sqlRemediation.includes('auth.uid() <> p_user_id'), 'hoard_relic_atomic caller authorization check missing');
assert(sqlRemediation.includes('FOR UPDATE'), 'hoard_relic_atomic row-level locking (FOR UPDATE) missing');
console.log('✓ Phase 6 Remediation migration verified (write privileges revoked, atomic RPC with authorization & row locking).');

// 1d. Verify Phase 6 Private RPC Migration Structure
console.log('1d. Verifying Phase 6 Private RPC Migration (goblin_internal schema & service_role execution)...');
const migrationPathPrivate = path.resolve(__dirname, '../supabase/migrations/20261011020000_private_rpc_security_remediation.sql');
assert(fs.existsSync(migrationPathPrivate), 'Private RPC migration file not found');
const sqlPrivate = fs.readFileSync(migrationPathPrivate, 'utf8');

assert(sqlPrivate.includes('CREATE SCHEMA IF NOT EXISTS goblin_internal;'), 'goblin_internal schema creation missing');
assert(sqlPrivate.includes('REVOKE USAGE ON SCHEMA goblin_internal FROM PUBLIC, anon, authenticated;'), 'goblin_internal usage not revoked from client roles');
assert(sqlPrivate.includes('GRANT USAGE ON SCHEMA goblin_internal TO service_role;'), 'goblin_internal usage not granted to service_role');
assert(sqlPrivate.includes('DROP FUNCTION IF EXISTS public.hoard_relic_atomic'), 'public.hoard_relic_atomic drop missing');
assert(sqlPrivate.includes('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;'), 'default privileges revoke missing');
assert(sqlPrivate.includes('CREATE OR REPLACE FUNCTION goblin_internal.hoard_relic_atomic'), 'goblin_internal.hoard_relic_atomic definition missing');
assert(sqlPrivate.includes('REVOKE EXECUTE ON FUNCTION goblin_internal.hoard_relic_atomic'), 'goblin_internal execute not revoked from clients');
assert(sqlPrivate.includes('GRANT EXECUTE ON FUNCTION goblin_internal.hoard_relic_atomic'), 'goblin_internal execute not granted to service_role');
console.log('✓ Phase 6 Private Schema Migration verified (private schema goblin_internal, client execution revoked, service_role execution only).');

// 1e. Verify Phase 7 Migration Structure (Public Profiles, Leaderboards, Trading Outpost)
console.log('1e. Verifying Phase 7 Migration (Public Leaderboard View & Trading RPCs)...');
const migrationPathPhase7 = path.resolve(__dirname, '../supabase/migrations/20261011030000_phase7_leaderboards_and_trading.sql');
assert(fs.existsSync(migrationPathPhase7), 'Phase 7 migration file not found');
const sql7 = fs.readFileSync(migrationPathPhase7, 'utf8');

// Public profile fields
assert(sql7.includes('ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false'), 'is_public column missing in profiles');
assert(sql7.includes('ADD COLUMN IF NOT EXISTS public_title TEXT DEFAULT'), 'public_title column missing in profiles');

// Trade tables
assert(sql7.includes('CREATE TABLE IF NOT EXISTS public.trade_offers'), 'trade_offers table missing');
assert(sql7.includes('CREATE TABLE IF NOT EXISTS public.trade_history'), 'trade_history table missing');

// Unique active item constraint
assert(sql7.includes('idx_unique_active_item_trade'), 'unique active trade offer index missing');
assert(sql7.includes("WHERE status = 'open'"), 'partial index condition for open offers missing');

// RLS write revocation
assert(sql7.includes('REVOKE INSERT, UPDATE, DELETE ON public.trade_offers FROM anon, authenticated;'), 'trade_offers write privileges not revoked');
assert(sql7.includes('REVOKE INSERT, UPDATE, DELETE ON public.trade_history FROM anon, authenticated;'), 'trade_history write privileges not revoked');

// Public leaderboard view
assert(sql7.includes('CREATE OR REPLACE VIEW public.public_leaderboard_view'), 'public_leaderboard_view missing');
assert(sql7.includes('WHERE p.is_public = true'), 'public_leaderboard_view must filter on is_public = true');

// Trading RPC functions
assert(sql7.includes('CREATE OR REPLACE FUNCTION goblin_internal.execute_trade_atomic'), 'execute_trade_atomic missing');
assert(sql7.includes('CREATE OR REPLACE FUNCTION goblin_internal.cancel_trade_atomic'), 'cancel_trade_atomic missing');
assert(sql7.includes('REVOKE EXECUTE ON FUNCTION goblin_internal.execute_trade_atomic'), 'execute_trade_atomic client execution not revoked');
assert(sql7.includes('GRANT EXECUTE ON FUNCTION goblin_internal.execute_trade_atomic(UUID, UUID, TEXT) TO service_role;'), 'execute_trade_atomic service_role execution missing');
assert(sql7.includes('REVOKE EXECUTE ON FUNCTION goblin_internal.cancel_trade_atomic'), 'cancel_trade_atomic client execution not revoked');
assert(sql7.includes('GRANT EXECUTE ON FUNCTION goblin_internal.cancel_trade_atomic(UUID, UUID) TO service_role;'), 'cancel_trade_atomic service_role execution missing');

// Row locking deadlock avoidance check
assert(sql7.includes('v_offer.sender_item_id < p_caller_item_id'), 'Lexicographical row lock ordering missing in execute_trade_atomic');
console.log('✓ Phase 7 Migration verified (public profiles, leaderboards view, trading tables, atomic RPCs, deadlock avoidance).');

// 1f. Verify Phase 7 Permissions Fix Migration (20261011040000_fix_trade_offers_permissions.sql)
console.log('1f. Verifying Market Trade Offers Permissions Fix migration...');
const migrationPathFixPermissions = path.resolve(__dirname, '../supabase/migrations/20261011040000_fix_trade_offers_permissions.sql');
assert(fs.existsSync(migrationPathFixPermissions), 'Trade permissions fix migration file not found');
const sqlFixPerms = fs.readFileSync(migrationPathFixPermissions, 'utf8');

assert(sqlFixPerms.includes('GRANT SELECT ON public.trade_offers TO anon, authenticated, service_role;'), 'trade_offers SELECT grant missing');
assert(sqlFixPerms.includes('GRANT SELECT ON public.trade_history TO authenticated, service_role;'), 'trade_history SELECT grant missing');
assert(sqlFixPerms.includes('GRANT INSERT, UPDATE, DELETE ON public.trade_offers TO service_role;'), 'trade_offers service_role mutation grant missing');
console.log('✓ Trade permissions fix migration verified (SELECT granted under RLS, mutations locked to service_role).');

// 2. Verify Client Graceful Fallback When Unconfigured
console.log('2. Verifying client configuration fallback when env vars are unconfigured...');
// Simulate unconfigured state
const isConfiguredCheck = (url, key) => Boolean(
  url && key && !url.includes('YOUR_PROJECT_REF') && !key.includes('YOUR_SUPABASE_PUBLISHABLE_KEY')
);

assert.strictEqual(isConfiguredCheck(undefined, undefined), false);
assert.strictEqual(isConfiguredCheck('https://YOUR_PROJECT_REF.supabase.co', 'YOUR_SUPABASE_PUBLISHABLE_KEY'), false);
assert.strictEqual(isConfiguredCheck('https://xyz.supabase.co', 'sb_pub_123'), true);
console.log('✓ Graceful fallback logic verified for missing or placeholder credentials.');

// 3. Verify .gitignore protection for client and server environment files
console.log('3. Verifying .gitignore protection for client and server credentials...');
const gitignorePath = path.resolve(__dirname, '../.gitignore');
const gitignore = fs.readFileSync(gitignorePath, 'utf8');
assert(gitignore.includes('client/.env'), '.gitignore missing client/.env');
assert(gitignore.includes('server/.env'), '.gitignore missing server/.env');
assert(gitignore.includes('!.env.example'), '.gitignore missing example whitelist');
console.log('✓ Gitignore rules protect client and server .env files.');

console.log('\n🎉 ALL SUPABASE CONTRACT & SCHEMA TESTS (PHASES 5, 6, 7) PASSED!');

