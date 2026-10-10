import React, { useState, useEffect, useCallback } from 'react';
import Uploader from './components/Uploader';
import LoadingGoblin from './components/LoadingGoblin';
import LootCard from './components/LootCard';
import ErrorMessage from './components/ErrorMessage';
import AuthModal from './components/AuthModal';
import InventoryView from './components/InventoryView';
import QuestView from './components/QuestView';
import ProgressionView from './components/ProgressionView';
import LeaderboardView from './components/LeaderboardView';
import TradingView from './components/TradingView';
import { resizeImage } from './lib/resizeImage';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const [view, setView] = useState('appraise'); // 'appraise' | 'inventory' | 'quests' | 'progression' | 'leaderboard' | 'trading'
  const [status, setStatus] = useState('idle'); // idle | resizing | appraising | success | error
  const [previewUrl, setPreviewUrl] = useState(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState(null);
  const [lootItem, setLootItem] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Auth & Profile state
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Inventory state
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState(null);

  // Progression & Quests state
  const [progressionState, setProgressionState] = useState(null);
  const [progressionLoading, setProgressionLoading] = useState(false);
  const [progressionError, setProgressionError] = useState(null);

  // Leaderboard state
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardCategory, setLeaderboardCategory] = useState('xp');
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardTotal, setLeaderboardTotal] = useState(0);
  const [userProfile, setUserProfile] = useState({ is_public: false, public_title: 'Apprentice Forager' });

  // Trading Outpost state
  const [tradeOffers, setTradeOffers] = useState([]);
  const [tradingLoading, setTradingLoading] = useState(false);
  const [tradingError, setTradingError] = useState(null);

  // Save item state
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  // Initialize Supabase Auth Listener
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user profile privacy info if signed in
  const fetchUserProfile = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_public, public_title')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data) {
        setUserProfile({
          is_public: Boolean(data.is_public),
          public_title: data.public_title || 'Apprentice Forager'
        });
      }
    } catch {
      // non-blocking
    }
  }, [user]);

  // Fetch Inventory from Server / Supabase
  const fetchInventory = useCallback(async () => {
    if (!user || !supabase) return;
    setInventoryLoading(true);
    setInventoryError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Authentication session expired.');

      // 1. Fetch from server endpoint
      const res = await fetch('/api/inventory', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const json = await res.json();
        setInventoryItems(json.items || []);
        return;
      }

      // 2. Fallback to direct client query under RLS if server endpoint is unavailable
      const { data, error } = await supabase
        .from('loot_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || error.message || 'Failed to fetch inventory from treasury.');
      }

      setInventoryItems(data || []);
    } catch (err) {
      setInventoryError(err.message || 'Failed to fetch inventory from treasury.');
    } finally {
      setInventoryLoading(false);
    }
  }, [user]);

  // Fetch Progression & Quests State from Backend
  const fetchProgression = useCallback(async () => {
    if (!user || !supabase) return;
    setProgressionLoading(true);
    setProgressionError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Authentication session expired.');

      const res = await fetch('/api/progression/state', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to load progression (HTTP ${res.status})`);
      }

      const json = await res.json();
      setProgressionState(json);
    } catch (err) {
      setProgressionError(err.message || 'Failed to fetch exploration progression.');
    } finally {
      setProgressionLoading(false);
    }
  }, [user]);

  // Fetch Leaderboards from Backend
  const fetchLeaderboards = useCallback(async (cat = leaderboardCategory, pg = leaderboardPage) => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);

    try {
      const res = await fetch(`/api/leaderboards?category=${cat}&page=${pg}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setLeaderboardData(json?.leaderboard || []);
      setLeaderboardTotal(json?.totalCount || 0);
    } catch (err) {
      setLeaderboardError(err.message || 'Failed to load leaderboards.');
    } finally {
      setLeaderboardLoading(false);
    }
  }, [leaderboardCategory, leaderboardPage]);

  // Fetch Trade Offers from Backend
  const fetchTradeOffers = useCallback(async () => {
    setTradingLoading(true);
    setTradingError(null);

    try {
      const res = await fetch('/api/trades/offers');
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setTradeOffers(json?.offers || []);
    } catch (err) {
      setTradingError(err.message || 'Failed to load trade offers.');
    } finally {
      setTradingLoading(false);
    }
  }, []);

  // Update Profile Privacy
  const handleUpdatePrivacy = async (isPublic, title) => {
    if (!user || !supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const res = await fetch('/api/profile/privacy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ is_public: isPublic, public_title: title })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update privacy');
    }
    setUserProfile({ is_public: isPublic, public_title: title });
    fetchLeaderboards();
  };

  // Create Trade Offer
  const handleCreateTradeOffer = async ({ item_id, wanted_description }) => {
    if (!user || !supabase) return { error: 'Not authenticated' };
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { error: 'Session expired' };

    const res = await fetch('/api/trades/offers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ item_id, wanted_description })
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || 'Failed to create trade offer' };
    fetchInventory();
    return json;
  };

  // Execute Trade Offer
  const handleExecuteTrade = async ({ offer_id, caller_item_id }) => {
    if (!user || !supabase) return { error: 'Not authenticated' };
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { error: 'Session expired' };

    const res = await fetch('/api/trades/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ offer_id, caller_item_id })
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || 'Trade execution failed' };
    fetchInventory();
    return json;
  };

  // Cancel Trade Offer
  const handleCancelTradeOffer = async (offer_id) => {
    if (!user || !supabase) return { error: 'Not authenticated' };
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { error: 'Session expired' };

    const res = await fetch('/api/trades/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ offer_id })
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || 'Failed to cancel offer' };
    return json;
  };

  // Refetch data whenever user signs in or switches views
  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
    if (user && view === 'inventory') {
      fetchInventory();
    }
    if (user && (view === 'quests' || view === 'progression')) {
      fetchProgression();
    }
    if (view === 'leaderboard') {
      fetchLeaderboards();
    }
    if (view === 'trading') {
      fetchTradeOffers();
      if (user) fetchInventory();
    }
  }, [user, view, fetchInventory, fetchProgression, fetchUserProfile, fetchLeaderboards, fetchTradeOffers]);

  // Handle selected image file
  const handleImageSelected = async (file) => {
    if (status === 'resizing' || status === 'appraising') return;

    setStatus('resizing');
    setErrorMessage(null);
    setLootItem(null);
    setIsSaved(false);
    setSaveFeedback(null);

    let resizeResult = null;
    try {
      resizeResult = await resizeImage(file, 1024, 0.8);
      setPreviewUrl(resizeResult.previewUrl);
      setThumbnailDataUrl(resizeResult.thumbnail);
    } catch (resizeErr) {
      setStatus('error');
      setErrorMessage(resizeErr.message);
      return;
    }

    // Send resized image to backend
    setStatus('appraising');

    const formData = new FormData();
    formData.append('image', resizeResult.blob, 'find.jpg');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('/api/appraise', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errDesc = `Server responded with HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error) errDesc = errData.error;
        } catch {
          // ignore parse error
        }
        throw new Error(errDesc);
      }

      const item = await response.json();
      setLootItem(item);
      setStatus('success');
    } catch (err) {
      clearTimeout(timeoutId);
      setStatus('error');
      if (err.name === 'AbortError') {
        setErrorMessage('The goblin took too long squinting at the relic (request timed out). Please check your connection and try again.');
      } else {
        setErrorMessage(err.message || 'Failed to complete appraisal. Please try again.');
      }
    }
  };

  // Handle saving item to inventory via server-authoritative save endpoint
  const handleSaveToInventory = async () => {
    if (!lootItem) return;

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (isSaving || isSaved) return;

    setIsSaving(true);
    setSaveFeedback(null);

    try {
      // 1. Obtain current valid session access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      // 2. Call server-authoritative save endpoint with bearer token
      const response = await fetch('/api/inventory/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          item: lootItem,
          thumbnail: thumbnailDataUrl || null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server responded with status ${response.status}`);
      }

      setIsSaved(true);
      setSaveFeedback(result.message || 'Relic successfully hoarded in your treasury!');
      // Refresh inventory items list for the user
      fetchInventory();
    } catch (err) {
      setSaveFeedback(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setPreviewUrl(null);
    setThumbnailDataUrl(null);
    setLootItem(null);
    setErrorMessage(null);
    setIsSaved(false);
    setSaveFeedback(null);
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      setInventoryItems([]);
      setView('appraise');
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0e0c] text-stone-200 flex flex-col items-center justify-between p-4 sm:p-6 selection:bg-emerald-900 selection:text-emerald-100">
      {/* Top Navigation & Profile Bar */}
      <nav className="w-full max-w-lg mx-auto flex items-center justify-between py-2 border-b border-stone-900 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView('appraise')}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
              view === 'appraise'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            🔍 Appraise
          </button>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                setAuthModalOpen(true);
              } else {
                setView('inventory');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              view === 'inventory'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span>🧺</span> Treasury
            {user && inventoryItems.length > 0 && (
              <span className="px-1.5 py-0.2 bg-stone-800 rounded-full text-[10px] text-amber-300 font-mono">
                {inventoryItems.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                setAuthModalOpen(true);
              } else {
                setView('quests');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              view === 'quests'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span>📜</span> Quests
          </button>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                setAuthModalOpen(true);
              } else {
                setView('progression');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              view === 'progression'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span>🎖️</span> Badges
          </button>
          <button
            type="button"
            onClick={() => setView('leaderboard')}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              view === 'leaderboard'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span>🏆</span> Ranks
          </button>
          <button
            type="button"
            onClick={() => setView('trading')}
            className={`px-2.5 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              view === 'trading'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span>⚖️</span> Market
            {tradeOffers.length > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-900/80 rounded-full text-[10px] text-emerald-300 font-mono">
                {tradeOffers.length}
              </span>
            )}
          </button>
        </div>

        <div>
          {!authLoading && (
            user ? (
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Account Name Pill */}
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-900/90 border border-emerald-950/80 text-stone-300 text-xs shadow-sm max-w-[120px] sm:max-w-[160px]"
                  title={user.email}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="font-semibold truncate tracking-tight text-[11px] text-stone-200">
                    {user.user_metadata?.username || user.email?.split('@')[0]}
                  </span>
                </div>

                {/* Exit / Sign Out Button */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold text-stone-400 bg-stone-900/60 border border-stone-800/80 hover:text-rose-300 hover:bg-stone-900 hover:border-rose-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-800 transition-colors cursor-pointer"
                  title="Sign out of LootGoblin"
                >
                  <span className="text-[10px]">🚪</span>
                  <span>Exit</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-xl font-bold bg-stone-900 hover:bg-stone-800 text-emerald-400 border border-emerald-900/80 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>🔑</span> Sign In
              </button>
            )
          )}
        </div>
      </nav>

      {/* Atmospheric Header */}
      <header className="w-full max-w-lg mx-auto text-center pt-5 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-xs font-semibold text-emerald-300 mb-3">
          <span>🌿</span> Touch Grass Open-Source AI
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-100 tracking-tight mb-2">
          IRL <span className="text-emerald-400">Loot Goblin</span>
        </h1>
        <p className="text-xs sm:text-sm text-stone-400 max-w-md mx-auto">
          Photograph things you find outdoors. Our eccentric Goblin Appraiser will inspect their visible traits and certify them as fictional RPG relics.
        </p>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-center py-2">
        {view === 'inventory' ? (
          <InventoryView
            items={inventoryItems}
            loading={inventoryLoading}
            error={inventoryError}
            onRefresh={fetchInventory}
            onAppraiseNew={() => setView('appraise')}
          />
        ) : view === 'quests' ? (
          <QuestView
            dailyQuests={progressionState?.dailyQuests || []}
            hunts={progressionState?.hunts || []}
            loading={progressionLoading}
            error={progressionError}
            onRefresh={fetchProgression}
            onAppraiseNew={() => setView('appraise')}
            user={user}
          />
        ) : view === 'progression' ? (
          <ProgressionView
            progression={progressionState?.progression}
            achievements={progressionState?.achievements || []}
            loading={progressionLoading}
            error={progressionError}
            onRefresh={fetchProgression}
            user={user}
          />
        ) : view === 'leaderboard' ? (
          <LeaderboardView
            leaderboard={leaderboardData}
            category={leaderboardCategory}
            onSelectCategory={(cat) => {
              setLeaderboardCategory(cat);
              fetchLeaderboards(cat, leaderboardPage);
            }}
            loading={leaderboardLoading}
            error={leaderboardError}
            page={leaderboardPage}
            totalCount={leaderboardTotal}
            onPageChange={(pg) => {
              setLeaderboardPage(pg);
              fetchLeaderboards(leaderboardCategory, pg);
            }}
            isPublic={userProfile.is_public}
            publicTitle={userProfile.public_title}
            onUpdatePrivacy={handleUpdatePrivacy}
            user={user}
          />
        ) : view === 'trading' ? (
          <TradingView
            offers={tradeOffers}
            myInventory={inventoryItems}
            loading={tradingLoading}
            error={tradingError}
            onRefresh={() => {
              fetchTradeOffers();
              if (user) fetchInventory();
            }}
            onCreateOffer={handleCreateTradeOffer}
            onExecuteTrade={handleExecuteTrade}
            onCancelOffer={handleCancelTradeOffer}
            user={user}
          />
        ) : (
          <>
            {status === 'idle' && (
              <Uploader onImageSelected={handleImageSelected} disabled={false} />
            )}

            {(status === 'resizing' || status === 'appraising') && (
              <LoadingGoblin previewUrl={previewUrl} />
            )}

            {status === 'success' && (
              <div className="space-y-3">
                {saveFeedback && (
                  <div className={`p-3 rounded-2xl text-center text-xs font-semibold border ${
                    saveFeedback.includes('error')
                      ? 'bg-rose-950/70 border-rose-800 text-rose-300'
                      : 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  }`}>
                    {saveFeedback}
                  </div>
                )}
                <LootCard
                  item={lootItem}
                  previewUrl={previewUrl}
                  onReset={handleReset}
                  onSave={handleSaveToInventory}
                  isSaved={isSaved}
                  isSaving={isSaving}
                  user={user}
                />
              </div>
            )}

            {status === 'error' && (
              <ErrorMessage
                error={errorMessage}
                onRetry={handleReset}
              />
            )}
          </>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(authenticatedUser) => {
          setUser(authenticatedUser);
          if (view === 'inventory') {
            fetchInventory();
          }
        }}
      />

      {/* Footer & Grounding Disclaimer */}
      <footer className="w-full max-w-lg mx-auto text-center pt-6 pb-2 text-[11px] text-stone-500 border-t border-stone-900 mt-6 space-y-1">
        <p>
          🌿 <span className="text-stone-400 font-medium">Touch Grass Rule:</span> Observe and photograph nature from afar. Never collect, disturb wildlife, or eat unknown plants.
        </p>
        <p className="text-stone-600">
          Powered by verified vision AI • Server-authoritative stats & loot rolls
        </p>
      </footer>
    </div>
  );
}
