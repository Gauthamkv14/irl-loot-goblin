-- ==============================================================================
-- IRL Loot Goblin - Fix Loot Items Permissions: Grant Select on loot_items
-- Migration: 20261011050000_fix_loot_items_permissions.sql
-- ==============================================================================

-- 1. Grant SELECT privilege on loot_items to authenticated and service_role
-- Note: Row Level Security (RLS) is enabled on public.loot_items, so granting SELECT
-- allows the RLS policy "Users can view own loot" to govern row-level visibility:
-- (auth.uid() = user_id).
GRANT SELECT ON public.loot_items TO authenticated, service_role;

-- 2. Enforce server-authoritative balance: revoke direct client mutation privileges
-- Direct writes (INSERT, UPDATE, DELETE) must remain revoked from anon and authenticated.
-- Saves must go through /api/inventory/save with verified HMAC-SHA256 signatures,
-- and are inserted atomically by goblin_internal.hoard_relic_atomic via service_role.
REVOKE INSERT, UPDATE, DELETE ON public.loot_items FROM anon, authenticated;

-- 3. Grant table mutation privileges exclusively to service_role
-- Internal RPCs (hoard_relic_atomic, execute_trade_atomic) run with service_role privileges.
GRANT INSERT, UPDATE, DELETE ON public.loot_items TO service_role;
