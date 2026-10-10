-- ==============================================================================
-- IRL Loot Goblin - Fix Security Definer Warning: Set security_invoker = true on public_leaderboard_view
-- Migration: 20261011060000_fix_leaderboard_security_invoker.sql
-- ==============================================================================

-- 1. Recreate public_leaderboard_view with security_invoker = true
-- By default in PostgreSQL, views run as the view owner (SECURITY DEFINER behavior).
-- Setting security_invoker = true resolves the Supabase Security Advisor CRITICAL warning
-- by enforcing that the view executes with the privileges and Row Level Security (RLS)
-- of the invoking user or role.
CREATE OR REPLACE VIEW public.public_leaderboard_view
WITH (security_invoker = true)
AS
SELECT
    p.id AS user_id,
    p.username,
    COALESCE(p.display_name, p.username) AS display_name,
    p.public_title,
    up.xp,
    up.level,
    up.goblin_coins,
    (SELECT count(*) FROM public.loot_items li WHERE li.user_id = p.id) AS total_hoarded,
    (SELECT count(*) FROM public.user_achievements ua WHERE ua.user_id = p.id) AS achievements_unlocked,
    up.updated_at AS last_progress_at
FROM public.profiles p
JOIN public.user_progression up ON up.user_id = p.id
WHERE p.is_public = true;

-- Ensure view attribute security_invoker = true is explicitly set
ALTER VIEW public.public_leaderboard_view SET (security_invoker = true);

-- 2. Maintain SELECT grants
-- The backend server queries this view via service_role to generate sanitized,
-- paginated public leaderboard rankings for visitors.
GRANT SELECT ON public.public_leaderboard_view TO anon, authenticated, service_role;
