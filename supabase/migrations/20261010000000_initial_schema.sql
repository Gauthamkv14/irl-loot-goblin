-- ==============================================================================
-- IRL Loot Goblin — Phase 5: Initial Schema & RLS Policies
-- Migration: 20261010000000_initial_schema.sql
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 2. Loot Items Table
CREATE TABLE IF NOT EXISTS public.loot_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    item_type TEXT NOT NULL,
    rarity TEXT NOT NULL CHECK (rarity IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary')),
    goblin_value INTEGER NOT NULL CHECK (goblin_value >= 0),
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    ability_name TEXT NOT NULL,
    ability_description TEXT NOT NULL,
    lore TEXT NOT NULL,
    appraisal TEXT NOT NULL,
    observed_object TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
    source TEXT NOT NULL CHECK (source IN ('model', 'fallback')),
    disclaimer TEXT NOT NULL,
    thumbnail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_item UNIQUE (user_id, item_id)
);

-- Indexes for performance and sorting
CREATE INDEX IF NOT EXISTS idx_loot_items_user_id ON public.loot_items(user_id);
CREATE INDEX IF NOT EXISTS idx_loot_items_user_rarity ON public.loot_items(user_id, rarity);
CREATE INDEX IF NOT EXISTS idx_loot_items_user_created ON public.loot_items(user_id, created_at DESC);

-- 3. Automatic Profile Creation Trigger on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_username TEXT;
    base_username TEXT;
BEGIN
    -- Extract username from user metadata or generate random goblin moniker
    base_username := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'username'), ''),
        NULLIF(SPLIT_PART(new.email, '@', 1), ''),
        'goblin_' || SUBSTRING(new.id::text, 1, 8)
    );
    -- Sanitize base username
    base_username := REGEXP_REPLACE(base_username, '[^a-zA-Z0-9_-]', '_', 'g');
    IF char_length(base_username) < 3 THEN
        base_username := 'goblin_' || SUBSTRING(new.id::text, 1, 8);
    END IF;
    clean_username := SUBSTRING(base_username, 1, 24);

    -- Ensure uniqueness by appending user UUID suffix if necessary
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = clean_username) THEN
        clean_username := SUBSTRING(clean_username, 1, 20) || '_' || SUBSTRING(new.id::text, 1, 4);
    END IF;

    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        new.id,
        clean_username,
        COALESCE(new.raw_user_meta_data->>'display_name', clean_username)
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Trigger to execute after auth.users row is inserted
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loot_items ENABLE ROW LEVEL SECURITY;

-- 5. Profiles RLS Policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update permitted profile fields (display_name, username) on their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 6. Loot Items RLS Policies
-- Users can read only their own inventory
CREATE POLICY "Users can view own loot"
    ON public.loot_items
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert items only for their own user_id (and with valid constraints)
CREATE POLICY "Users can insert own loot"
    ON public.loot_items
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete items from their own inventory
CREATE POLICY "Users can delete own loot"
    ON public.loot_items
    FOR DELETE
    USING (auth.uid() = user_id);

-- NO UPDATE POLICY: Once hoarded, item stats, rarity, and coins are IMMUTABLE.
-- REVOKE direct UPDATE permissions on loot_items from authenticated and anon roles
REVOKE UPDATE ON public.loot_items FROM anon, authenticated;
