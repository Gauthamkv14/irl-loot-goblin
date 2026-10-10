-- ==============================================================================
-- IRL Loot Goblin - Phase 6 Remediation: Private Schema RPC & Service Role Execution
-- Migration: 20261011020000_private_rpc_security_remediation.sql
-- ==============================================================================

-- 1. Create Private Internal Schema (Inaccessible to PostgREST / Client Data API)
CREATE SCHEMA IF NOT EXISTS goblin_internal;

-- Ensure public/anon/authenticated cannot access goblin_internal schema
REVOKE USAGE ON SCHEMA goblin_internal FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA goblin_internal TO service_role;

-- 2. Drop the exposed public RPC function if it was previously created
REVOKE EXECUTE ON FUNCTION public.hoard_relic_atomic(UUID, JSONB, TEXT, TEXT, TEXT[], JSONB, TEXT[]) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.hoard_relic_atomic(UUID, JSONB, TEXT, TEXT, TEXT[], JSONB, TEXT[]);

-- Also adjust default function privileges in public schema to prevent future auto-grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 3. Define hoard_relic_atomic inside goblin_internal
-- This ensures the function is NEVER exposed to PostgREST client RPC calls,
-- completely closing the direct client execution attack vector.
-- The function runs with SECURITY DEFINER and a fixed search_path.

CREATE OR REPLACE FUNCTION goblin_internal.hoard_relic_atomic(
    p_user_id UUID,
    p_item JSONB,
    p_thumbnail TEXT,
    p_today_date TEXT,
    p_eligible_quest_ids TEXT[],
    p_eligible_hunt_objectives JSONB,
    p_eligible_achievements TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, goblin_internal
AS $$
DECLARE
    v_item_id TEXT;
    v_rarity TEXT;
    v_goblin_value INTEGER;
    v_base_xp INTEGER;
    v_total_xp_earned INTEGER := 0;
    v_total_coins_earned INTEGER := 0;
    v_current_xp INTEGER := 0;
    v_current_coins INTEGER := 0;
    v_current_level INTEGER := 1;
    v_new_xp INTEGER := 0;
    v_new_coins INTEGER := 0;
    v_new_level INTEGER := 1;
    v_quest_id TEXT;
    v_target INTEGER;
    v_quest_xp INTEGER;
    v_quest_coins INTEGER;
    v_prev_progress INTEGER;
    v_prev_completed BOOLEAN;
    v_hunt_item JSONB;
    v_h_id TEXT;
    v_obj_id TEXT;
    v_ach_id TEXT;
    v_unlocked_achievements TEXT[] := ARRAY[]::TEXT[];
    v_completed_quests TEXT[] := ARRAY[]::TEXT[];
    v_completed_hunt_objectives TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- 1. Identity & Profile Integrity Check
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User ID must not be null';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: Specified user profile does not exist';
    END IF;

    v_item_id := p_item->>'id';
    v_rarity := p_item->>'rarity';
    v_goblin_value := COALESCE((p_item->>'goblin_value')::INTEGER, 0);

    IF v_item_id IS NULL OR v_rarity IS NULL THEN
        RAISE EXCEPTION 'Invalid loot item: missing id or rarity';
    END IF;

    -- Strict server-enforced bounds validation on rarity & goblin_value inside PostgreSQL:
    -- Common: 1-10 coins
    -- Uncommon: 10-40 coins
    -- Rare: 40-150 coins
    -- Epic: 150-600 coins
    -- Legendary: 600-2000 coins
    CASE v_rarity
        WHEN 'Common' THEN
            v_base_xp := 15;
            IF v_goblin_value < 1 OR v_goblin_value > 10 THEN v_goblin_value := 5; END IF;
        WHEN 'Uncommon' THEN
            v_base_xp := 25;
            IF v_goblin_value < 10 OR v_goblin_value > 40 THEN v_goblin_value := 25; END IF;
        WHEN 'Rare' THEN
            v_base_xp := 45;
            IF v_goblin_value < 40 OR v_goblin_value > 150 THEN v_goblin_value := 95; END IF;
        WHEN 'Epic' THEN
            v_base_xp := 80;
            IF v_goblin_value < 150 OR v_goblin_value > 600 THEN v_goblin_value := 375; END IF;
        WHEN 'Legendary' THEN
            v_base_xp := 150;
            IF v_goblin_value < 600 OR v_goblin_value > 2000 THEN v_goblin_value := 1300; END IF;
        ELSE
            RAISE EXCEPTION 'Invalid rarity tier: %', v_rarity;
    END CASE;

    -- 2. Idempotency Check: Was relic already hoarded?
    IF EXISTS (SELECT 1 FROM public.loot_items WHERE user_id = p_user_id AND item_id = v_item_id) THEN
        RETURN jsonb_build_object(
            'ok', true,
            'alreadySaved', true,
            'message', 'Relic was already hoarded in your treasury!',
            'progression', NULL
        );
    END IF;

    -- 3. Insert Relic into loot_items
    INSERT INTO public.loot_items (
        user_id,
        item_id,
        name,
        item_type,
        rarity,
        goblin_value,
        stats,
        ability_name,
        ability_description,
        lore,
        appraisal,
        observed_object,
        confidence,
        source,
        disclaimer,
        thumbnail
    ) VALUES (
        p_user_id,
        v_item_id,
        p_item->>'name',
        p_item->>'item_type',
        v_rarity,
        v_goblin_value,
        COALESCE(p_item->'stats', '{}'::jsonb),
        p_item->>'ability_name',
        p_item->>'ability_description',
        p_item->>'lore',
        p_item->>'appraisal',
        p_item->>'observed_object',
        p_item->>'confidence',
        p_item->>'source',
        p_item->>'disclaimer',
        p_thumbnail
    );

    v_total_xp_earned := v_base_xp;
    v_total_coins_earned := v_goblin_value;

    -- 4. Lock and Retrieve Current User Progression Row (Prevents Lost Updates)
    SELECT xp, goblin_coins, level
    INTO v_current_xp, v_current_coins, v_current_level
    FROM public.user_progression
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Initialize row if missing
        INSERT INTO public.user_progression (user_id, xp, level, goblin_coins)
        VALUES (p_user_id, 0, 1, 0)
        RETURNING xp, goblin_coins, level INTO v_current_xp, v_current_coins, v_current_level;
    END IF;

    -- 5. Process Eligible Daily Quests
    IF p_eligible_quest_ids IS NOT NULL THEN
        FOREACH v_quest_id IN ARRAY p_eligible_quest_ids LOOP
            CASE v_quest_id
                WHEN 'daily_appraise_1' THEN v_target := 1; v_quest_xp := 35; v_quest_coins := 20;
                WHEN 'daily_uncommon_plus' THEN v_target := 1; v_quest_xp := 50; v_quest_coins := 35;
                WHEN 'daily_three_relics' THEN v_target := 3; v_quest_xp := 75; v_quest_coins := 50;
                WHEN 'daily_rare_find' THEN v_target := 1; v_quest_xp := 80; v_quest_coins := 60;
                WHEN 'daily_observe_organic' THEN v_target := 1; v_quest_xp := 40; v_quest_coins := 25;
                ELSE CONTINUE; -- Unknown quest ID ignored
            END CASE;

            SELECT progress, completed INTO v_prev_progress, v_prev_completed
            FROM public.daily_quest_progress
            WHERE user_id = p_user_id AND quest_id = v_quest_id AND quest_date = p_today_date
            FOR UPDATE;

            IF NOT FOUND THEN
                IF 1 >= v_target THEN
                    INSERT INTO public.daily_quest_progress (
                        user_id, quest_id, quest_date, progress, target, completed, completed_at, reward_claimed
                    ) VALUES (
                        p_user_id, v_quest_id, p_today_date, 1, v_target, true, now(), true
                    );
                    v_total_xp_earned := v_total_xp_earned + v_quest_xp;
                    v_total_coins_earned := v_total_coins_earned + v_quest_coins;
                    v_completed_quests := array_append(v_completed_quests, v_quest_id);
                ELSE
                    INSERT INTO public.daily_quest_progress (
                        user_id, quest_id, quest_date, progress, target, completed
                    ) VALUES (
                        p_user_id, v_quest_id, p_today_date, 1, v_target, false
                    );
                END IF;
            ELSIF NOT v_prev_completed THEN
                IF (v_prev_progress + 1) >= v_target THEN
                    UPDATE public.daily_quest_progress
                    SET progress = v_target,
                        completed = true,
                        completed_at = now(),
                        reward_claimed = true
                    WHERE user_id = p_user_id AND quest_id = v_quest_id AND quest_date = p_today_date;

                    v_total_xp_earned := v_total_xp_earned + v_quest_xp;
                    v_total_coins_earned := v_total_coins_earned + v_quest_coins;
                    v_completed_quests := array_append(v_completed_quests, v_quest_id);
                ELSE
                    UPDATE public.daily_quest_progress
                    SET progress = v_prev_progress + 1
                    WHERE user_id = p_user_id AND quest_id = v_quest_id AND quest_date = p_today_date;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 6. Process Scavenger Hunt Objectives
    IF p_eligible_hunt_objectives IS NOT NULL THEN
        FOR v_hunt_item IN SELECT * FROM jsonb_array_elements(p_eligible_hunt_objectives) LOOP
            v_h_id := v_hunt_item->>'hunt_id';
            v_obj_id := v_hunt_item->>'objective_id';

            IF v_h_id IS NOT NULL AND v_obj_id IS NOT NULL THEN
                BEGIN
                    INSERT INTO public.hunt_progress (
                        user_id, hunt_id, objective_id, item_id, completed
                    ) VALUES (
                        p_user_id, v_h_id, v_obj_id, v_item_id, true
                    );

                    v_total_xp_earned := v_total_xp_earned + 30;
                    v_completed_hunt_objectives := array_append(v_completed_hunt_objectives, v_obj_id);

                    IF (SELECT count(*) FROM public.hunt_progress WHERE user_id = p_user_id AND hunt_id = v_h_id) = 3 THEN
                        v_total_xp_earned := v_total_xp_earned + 120;
                        v_total_coins_earned := v_total_coins_earned + 80;
                    END IF;
                EXCEPTION
                    WHEN unique_violation THEN
                        NULL;
                END;
            END IF;
        END LOOP;
    END IF;

    -- 7. Process Achievements
    IF p_eligible_achievements IS NOT NULL THEN
        FOREACH v_ach_id IN ARRAY p_eligible_achievements LOOP
            BEGIN
                INSERT INTO public.user_achievements (
                    user_id, achievement_id
                ) VALUES (
                    p_user_id, v_ach_id
                );

                CASE v_ach_id
                    WHEN 'ach_first_hoard' THEN v_total_xp_earned := v_total_xp_earned + 50;
                    WHEN 'ach_five_relics' THEN v_total_xp_earned := v_total_xp_earned + 100;
                    WHEN 'ach_fifteen_relics' THEN v_total_xp_earned := v_total_xp_earned + 250;
                    WHEN 'ach_rare_discovery' THEN v_total_xp_earned := v_total_xp_earned + 100;
                    WHEN 'ach_epic_discovery' THEN v_total_xp_earned := v_total_xp_earned + 200;
                    WHEN 'ach_legendary_discovery' THEN v_total_xp_earned := v_total_xp_earned + 500;
                    WHEN 'ach_daily_quest_master' THEN v_total_xp_earned := v_total_xp_earned + 75;
                    WHEN 'ach_hunt_completed' THEN v_total_xp_earned := v_total_xp_earned + 150;
                    ELSE CONTINUE;
                END CASE;

                v_unlocked_achievements := array_append(v_unlocked_achievements, v_ach_id);
            EXCEPTION
                WHEN unique_violation THEN
                    NULL;
            END;
        END LOOP;
    END IF;

    -- 8. Atomically Update user_progression
    v_new_xp := v_current_xp + v_total_xp_earned;
    v_new_coins := v_current_coins + v_total_coins_earned;

    IF v_new_xp < 100 THEN v_new_level := 1;
    ELSIF v_new_xp < 250 THEN v_new_level := 2;
    ELSIF v_new_xp < 450 THEN v_new_level := 3;
    ELSIF v_new_xp < 700 THEN v_new_level := 4;
    ELSIF v_new_xp < 1000 THEN v_new_level := 5;
    ELSIF v_new_xp < 1400 THEN v_new_level := 6;
    ELSIF v_new_xp < 1900 THEN v_new_level := 7;
    ELSIF v_new_xp < 2500 THEN v_new_level := 8;
    ELSIF v_new_xp < 3200 THEN v_new_level := 9;
    ELSE v_new_level := 10 + ((v_new_xp - 3200) / 1000);
    END IF;

    UPDATE public.user_progression
    SET xp = v_new_xp,
        goblin_coins = v_new_coins,
        level = v_new_level,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- 9. Return Atomic Result
    RETURN jsonb_build_object(
        'ok', true,
        'alreadySaved', false,
        'message', 'Relic successfully hoarded in your treasury!',
        'progression', jsonb_build_object(
            'xpEarned', v_total_xp_earned,
            'coinsEarned', v_total_coins_earned,
            'totalXp', v_new_xp,
            'level', v_new_level,
            'leveledUp', v_new_level > v_current_level,
            'unlockedAchievements', to_jsonb(v_unlocked_achievements),
            'completedQuests', to_jsonb(v_completed_quests),
            'completedHuntObjectives', to_jsonb(v_completed_hunt_objectives)
        )
    );
END;
$$;

-- 4. Restrict Execution Privileges
-- Only service_role can execute goblin_internal.hoard_relic_atomic.
-- Neither anon, authenticated, nor PUBLIC have EXECUTE rights on this function or USAGE on goblin_internal.
REVOKE EXECUTE ON FUNCTION goblin_internal.hoard_relic_atomic(UUID, JSONB, TEXT, TEXT, TEXT[], JSONB, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION goblin_internal.hoard_relic_atomic(UUID, JSONB, TEXT, TEXT, TEXT[], JSONB, TEXT[]) TO service_role;
