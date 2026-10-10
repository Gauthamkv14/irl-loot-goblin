-- ==============================================================================
-- IRL Loot Goblin — Phase 7: Public Profiles, Leaderboards & Trading Outpost
-- Migration: 20261011030000_phase7_leaderboards_and_trading.sql
-- ==============================================================================

-- 1. EXTEND PROFILES FOR PUBLIC OPT-IN & CUSTOM DISPLAY NAME
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS public_title TEXT DEFAULT 'Apprentice Forager';

-- 2. CREATE TRADING OFFERS TABLE
CREATE TABLE IF NOT EXISTS public.trade_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_item_id TEXT NOT NULL,
    sender_item_name TEXT NOT NULL,
    sender_item_rarity TEXT NOT NULL,
    sender_item_thumbnail TEXT,
    wanted_description TEXT NOT NULL, -- Short description of desired items
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL = open to public
    recipient_item_id TEXT, -- Populated upon proposal or trade execution
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for searching open trade offers
CREATE INDEX IF NOT EXISTS idx_trade_offers_status ON public.trade_offers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_offers_sender ON public.trade_offers(sender_id, status);

-- Unique index ensuring an item cannot be in multiple conflicting active open offers
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_item_trade 
    ON public.trade_offers(sender_id, sender_item_id) 
    WHERE status = 'open';

-- 3. CREATE TRADE HISTORY LOG TABLE
CREATE TABLE IF NOT EXISTS public.trade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID REFERENCES public.trade_offers(id) ON DELETE SET NULL,
    party_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    party_a_item_id TEXT NOT NULL,
    party_b_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    party_b_item_id TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_trade_history_users ON public.trade_history(party_a_id, party_b_id);

-- 4. ENABLE RLS ON TRADING TABLES
ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR TRADING
-- Anyone authenticated can view active public open trade offers
CREATE POLICY "View open public trades or user trades"
    ON public.trade_offers
    FOR SELECT
    USING (
        status = 'open' 
        OR auth.uid() = sender_id 
        OR auth.uid() = recipient_id
    );

-- Users can view their own trade history
CREATE POLICY "View own trade history"
    ON public.trade_history
    FOR SELECT
    USING (auth.uid() = party_a_id OR auth.uid() = party_b_id);

-- Direct client updates/deletes on trade_offers and trade_history are strictly revoked
REVOKE INSERT, UPDATE, DELETE ON public.trade_offers FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.trade_history FROM anon, authenticated;

-- 6. PUBLIC PROFILES VIEW (Safe, non-leaking projection of opted-in users)
CREATE OR REPLACE VIEW public.public_leaderboard_view AS
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

-- Grant select on public_leaderboard_view to authenticated and anon
GRANT SELECT ON public.public_leaderboard_view TO anon, authenticated;

-- 7. DEFINE ATOMIC TRADE EXECUTION RPC IN goblin_internal
-- Transaction-safe item-for-item transfer with row locking on both parties and both loot items
CREATE OR REPLACE FUNCTION goblin_internal.execute_trade_atomic(
    p_offer_id UUID,
    p_caller_id UUID,
    p_caller_item_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, goblin_internal
AS $$
DECLARE
    v_offer RECORD;
    v_sender_item RECORD;
    v_caller_item RECORD;
BEGIN
    -- 1. Authorization check
    IF p_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller ID required';
    END IF;

    -- 2. Lock and retrieve trade offer
    SELECT * INTO v_offer
    FROM public.trade_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trade offer not found';
    END IF;

    IF v_offer.status <> 'open' THEN
        RAISE EXCEPTION 'Trade offer is no longer open (status: %)', v_offer.status;
    END IF;

    IF v_offer.sender_id = p_caller_id THEN
        RAISE EXCEPTION 'Cannot trade with yourself';
    END IF;

    IF v_offer.recipient_id IS NOT NULL AND v_offer.recipient_id <> p_caller_id THEN
        RAISE EXCEPTION 'Trade offer is reserved for another hoarder';
    END IF;

    -- 3. Lock both loot items to verify ownership and prevent race conditions
    -- Ensure lock acquisition ordering (alphabetical by item_id) to prevent deadlocks
    IF v_offer.sender_item_id < p_caller_item_id THEN
        SELECT * INTO v_sender_item FROM public.loot_items WHERE user_id = v_offer.sender_id AND item_id = v_offer.sender_item_id FOR UPDATE;
        SELECT * INTO v_caller_item FROM public.loot_items WHERE user_id = p_caller_id AND item_id = p_caller_item_id FOR UPDATE;
    ELSE
        SELECT * INTO v_caller_item FROM public.loot_items WHERE user_id = p_caller_id AND item_id = p_caller_item_id FOR UPDATE;
        SELECT * INTO v_sender_item FROM public.loot_items WHERE user_id = v_offer.sender_id AND item_id = v_offer.sender_item_id FOR UPDATE;
    END IF;

    IF v_sender_item.item_id IS NULL THEN
        RAISE EXCEPTION 'Sender no longer possesses the listed trade item';
    END IF;

    IF v_caller_item.item_id IS NULL THEN
        RAISE EXCEPTION 'You do not own the item proposed for this trade';
    END IF;

    -- 4. Atomically Transfer Ownership:
    -- Temporary update to satisfy unique_user_item constraint if same item_id was somehow traded
    -- Swap owner of sender_item to caller
    UPDATE public.loot_items
    SET user_id = p_caller_id
    WHERE id = v_sender_item.id;

    -- Swap owner of caller_item to sender
    UPDATE public.loot_items
    SET user_id = v_offer.sender_id
    WHERE id = v_caller_item.id;

    -- 5. Update Offer Status to Completed
    UPDATE public.trade_offers
    SET status = 'completed',
        recipient_id = p_caller_id,
        recipient_item_id = p_caller_item_id,
        updated_at = now()
    WHERE id = p_offer_id;

    -- 6. Record in Trade History Log
    INSERT INTO public.trade_history (
        offer_id,
        party_a_id,
        party_a_item_id,
        party_b_id,
        party_b_item_id
    ) VALUES (
        p_offer_id,
        v_offer.sender_id,
        v_offer.sender_item_id,
        p_caller_id,
        p_caller_item_id
    );

    RETURN jsonb_build_object(
        'ok', true,
        'message', 'Trade completed successfully! Relics transferred.',
        'receivedItemName', v_sender_item.name,
        'givenItemName', v_caller_item.name
    );
END;
$$;

-- 8. DEFINE CANCEL TRADE RPC IN goblin_internal
CREATE OR REPLACE FUNCTION goblin_internal.cancel_trade_atomic(
    p_offer_id UUID,
    p_caller_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, goblin_internal
AS $$
DECLARE
    v_offer RECORD;
BEGIN
    SELECT * INTO v_offer
    FROM public.trade_offers
    WHERE id = p_offer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trade offer not found';
    END IF;

    IF v_offer.sender_id <> p_caller_id THEN
        RAISE EXCEPTION 'Unauthorized: Only the creator can cancel this offer';
    END IF;

    IF v_offer.status <> 'open' THEN
        RAISE EXCEPTION 'Offer is no longer open';
    END IF;

    UPDATE public.trade_offers
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = p_offer_id;

    RETURN jsonb_build_object(
        'ok', true,
        'message', 'Trade offer successfully cancelled.'
    );
END;
$$;

-- Restrict execution on trade RPCs to service_role exclusively
REVOKE EXECUTE ON FUNCTION goblin_internal.execute_trade_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION goblin_internal.execute_trade_atomic(UUID, UUID, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION goblin_internal.cancel_trade_atomic(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION goblin_internal.cancel_trade_atomic(UUID, UUID) TO service_role;
