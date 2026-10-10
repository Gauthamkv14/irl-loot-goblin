-- ==============================================================================
-- IRL Loot Goblin — Fix Market Permissions: Grant Select on Trading Tables
-- Migration: 20261011040000_fix_trade_offers_permissions.sql
-- ==============================================================================

-- 1. Grant SELECT privilege on trading tables to anon, authenticated, and service_role
-- Note: Row Level Security (RLS) is enabled on both tables, so granting SELECT
-- allows RLS policies to govern row-level visibility:
-- - trade_offers: RLS policy "View open public trades or user trades" restricts rows
--   to (status = 'open' OR auth.uid() = sender_id OR auth.uid() = recipient_id).
-- - trade_history: RLS policy "View own trade history" restricts rows
--   to (auth.uid() = party_a_id OR auth.uid() = party_b_id).
GRANT SELECT ON public.trade_offers TO anon, authenticated, service_role;
GRANT SELECT ON public.trade_history TO authenticated, service_role;

-- 2. Grant table mutation privileges exclusively to service_role
-- Direct client writes (INSERT, UPDATE, DELETE) remain REVOKED from anon and authenticated.
-- Only the backend server client (using SUPABASE_SERVICE_ROLE_KEY) or SECURITY DEFINER RPCs
-- can insert trade offers or execute atomic trades.
GRANT INSERT, UPDATE, DELETE ON public.trade_offers TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.trade_history TO service_role;
