-- ==============================================================================
-- IRL Loot Goblin - Grant Underlying Permissions for Security Invoker Leaderboard
-- Migration: 20261011070000_grant_underlying_leaderboard_permissions.sql
-- ==============================================================================

-- 1. Grant SELECT on profiles, progression, and achievements to service_role and authenticated
-- Note: Row Level Security (RLS) is enabled on all tables:
-- - public.profiles: policy "Users can view own profile" restricts authenticated users to (auth.uid() = id).
-- - public.user_progression: policy "Users can view own progression" restricts to (auth.uid() = user_id).
-- - public.user_achievements: policy "Users can view own achievements" restricts to (auth.uid() = user_id).
-- - public.daily_quest_progress: policy "Users can view own quest progress" restricts to (auth.uid() = user_id).
-- - public.hunt_progress: policy "Users can view own hunt progress" restricts to (auth.uid() = user_id).
--
-- The service_role (used by the server) has BYPASSRLS, but in PostgreSQL it still requires
-- table-level SELECT grants to execute views defined with security_invoker = true.
GRANT SELECT ON public.profiles TO authenticated, service_role;
GRANT SELECT ON public.user_progression TO authenticated, service_role;
GRANT SELECT ON public.user_achievements TO authenticated, service_role;
GRANT SELECT ON public.daily_quest_progress TO authenticated, service_role;
GRANT SELECT ON public.hunt_progress TO authenticated, service_role;

-- 2. Allow authenticated users to update their own permitted profile fields under RLS
GRANT UPDATE (display_name, is_public, public_title, updated_at) ON public.profiles TO authenticated;

-- 3. Grant mutation privileges on these tables exclusively to service_role
-- Direct client mutations (INSERT, UPDATE, DELETE) remain REVOKED from anon and authenticated.
GRANT INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.user_progression TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.user_achievements TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.daily_quest_progress TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.hunt_progress TO service_role;
