-- ==============================================================================
-- IRL Loot Goblin - Phase 6: Progression, Quests & Achievements Schema & RLS
-- Migration: 20261011000000_phase6_progression.sql
-- ==============================================================================

-- 1. User Progression Table (XP, Level, Currency totals)
CREATE TABLE IF NOT EXISTS public.user_progression (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    goblin_coins INTEGER NOT NULL DEFAULT 0 CHECK (goblin_coins >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for progression lookups
CREATE INDEX IF NOT EXISTS idx_user_progression_level ON public.user_progression(level);

-- 2. Daily Quest Progress Table
CREATE TABLE IF NOT EXISTS public.daily_quest_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL,
    quest_date TEXT NOT NULL, -- Format: YYYY-MM-DD (UTC)
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    target INTEGER NOT NULL CHECK (target > 0),
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    reward_claimed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_daily_quest UNIQUE (user_id, quest_id, quest_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_quest_user_date ON public.daily_quest_progress(user_id, quest_date);

-- 3. Scavenger Hunt Progress Table
CREATE TABLE IF NOT EXISTS public.hunt_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hunt_id TEXT NOT NULL,
    objective_id TEXT NOT NULL,
    item_id TEXT, -- References loot_items(item_id) if completed via hoard
    completed BOOLEAN NOT NULL DEFAULT true,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_hunt_objective UNIQUE (user_id, hunt_id, objective_id)
);

CREATE INDEX IF NOT EXISTS idx_hunt_progress_user_hunt ON public.hunt_progress(user_id, hunt_id);

-- 4. User Achievements Table
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);

-- 5. Auto-Initialize Progression for New Users Trigger Enhancement
CREATE OR REPLACE FUNCTION public.handle_new_user_progression()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_progression (user_id, xp, level, goblin_coins)
    VALUES (new.id, 0, 1, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_init_progression ON public.profiles;
CREATE TRIGGER on_profile_created_init_progression
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_progression();

-- 6. Enable Row Level Security (RLS) on all Phase 6 Tables
ALTER TABLE public.user_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: User-Specific Isolation
-- Progression
CREATE POLICY "Users can view own progression"
    ON public.user_progression
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own initial progression"
    ON public.user_progression
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progression"
    ON public.user_progression
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Daily Quests
CREATE POLICY "Users can view own quest progress"
    ON public.daily_quest_progress
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quest progress"
    ON public.daily_quest_progress
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quest progress"
    ON public.daily_quest_progress
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Hunt Progress
CREATE POLICY "Users can view own hunt progress"
    ON public.hunt_progress
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hunt progress"
    ON public.hunt_progress
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Achievements
CREATE POLICY "Users can view own achievements"
    ON public.user_achievements
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
    ON public.user_achievements
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Least Privilege: Revoke DELETE and unauthenticated access
REVOKE DELETE ON public.user_progression FROM anon, authenticated;
REVOKE UPDATE ON public.user_achievements FROM anon, authenticated;
REVOKE UPDATE ON public.hunt_progress FROM anon, authenticated;
