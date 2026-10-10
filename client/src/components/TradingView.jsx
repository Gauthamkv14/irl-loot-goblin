import React, { useState } from 'react';

const RARITY_COLORS = {
  Common: 'border-stone-700 text-stone-300 bg-stone-900/60',
  Uncommon: 'border-emerald-700 text-emerald-400 bg-emerald-950/40',
  Rare: 'border-sky-700 text-sky-400 bg-sky-950/40',
  Epic: 'border-purple-700 text-purple-400 bg-purple-950/40',
  Legendary: 'border-amber-600 text-amber-300 bg-amber-950/40'
};

export default function TradingView({
  offers = [],
  myInventory = [],
  loading = false,
  error = null,
  onRefresh,
  onCreateOffer,
  onExecuteTrade,
  onCancelOffer,
  user
}) {
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'create'
  const [selectedOfferForTrade, setSelectedOfferForTrade] = useState(null);
  const [callerItemId, setCallerItemId] = useState('');
  const [submittingTrade, setSubmittingTrade] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Create offer state
  const [listItemId, setListItemId] = useState('');
  const [wantedDescription, setWantedDescription] = useState('');
  const [creatingOffer, setCreatingOffer] = useState(false);

  // Handling trade offer creation
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!listItemId || !wantedDescription) return;

    setCreatingOffer(true);
    setActionFeedback(null);
    try {
      const res = await onCreateOffer({
        item_id: listItemId,
        wanted_description: wantedDescription
      });
      if (res?.error) {
        setActionFeedback({ type: 'error', message: res.error });
      } else {
        setActionFeedback({ type: 'success', message: 'Relic placed on the trading outpost!' });
        setListItemId('');
        setWantedDescription('');
        setActiveTab('browse');
        onRefresh();
      }
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to list relic.' });
    } finally {
      setCreatingOffer(false);
    }
  };

  // Handling accepting a trade
  const handleExecuteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOfferForTrade || !callerItemId) return;

    setSubmittingTrade(true);
    setActionFeedback(null);
    try {
      const res = await onExecuteTrade({
        offer_id: selectedOfferForTrade.id,
        caller_item_id: callerItemId
      });
      if (res?.error) {
        setActionFeedback({ type: 'error', message: res.error });
      } else {
        setActionFeedback({ type: 'success', message: 'Trade executed successfully! Relics transferred.' });
        setSelectedOfferForTrade(null);
        setCallerItemId('');
        onRefresh();
      }
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message || 'Trade execution failed.' });
    } finally {
      setSubmittingTrade(false);
    }
  };

  // Handling cancel offer
  const handleCancel = async (offerId) => {
    if (!window.confirm('Cancel this active trade offer and return relic to treasury?')) return;
    setActionFeedback(null);
    try {
      const res = await onCancelOffer(offerId);
      if (res?.error) {
        setActionFeedback({ type: 'error', message: res.error });
      } else {
        setActionFeedback({ type: 'success', message: 'Trade offer cancelled.' });
        onRefresh();
      }
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to cancel offer.' });
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto py-2 space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚖️</span>
            <h2 className="text-lg font-extrabold text-stone-100">Trading Outpost</h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            Item Exchange
          </span>
        </div>
        <p className="text-xs text-stone-400 leading-relaxed">
          Barter your hoarded curios with fellow foragers. Offer an authentic relic and swap it safely for another adventurer's discovery.
        </p>

        {/* Tab Selector */}
        <div className="flex gap-2 pt-2 border-t border-stone-800/80">
          <button
            type="button"
            onClick={() => { setActiveTab('browse'); setActionFeedback(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
              activeTab === 'browse'
                ? 'bg-stone-800 text-emerald-400 border border-emerald-800/80 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            🏪 Active Offers ({offers.length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                setActionFeedback({ type: 'error', message: 'Sign in to place trade offers.' });
                return;
              }
              setActiveTab('create');
              setActionFeedback(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
              activeTab === 'create'
                ? 'bg-stone-800 text-amber-400 border border-amber-800/80 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            ➕ Post an Offer
          </button>
        </div>
      </div>

      {/* Action / Error Feedback Notification */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold text-center border ${
            actionFeedback.type === 'error'
              ? 'bg-rose-950/70 border-rose-800 text-rose-300'
              : 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
          }`}
        >
          {actionFeedback.message}
        </div>
      )}

      {/* Create Trade Offer Tab */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateSubmit} className="bg-stone-900/70 border border-stone-800 rounded-3xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
            <span>📦</span> Select Relic to Offer
          </h3>

          <div>
            <label className="block text-[11px] text-stone-400 mb-1">Your Treasury Item:</label>
            {myInventory.length === 0 ? (
              <p className="text-xs text-stone-500 italic">No hoarded relics in your treasury to trade.</p>
            ) : (
              <select
                value={listItemId}
                onChange={(e) => setListItemId(e.target.value)}
                required
                className="w-full bg-stone-950 border border-stone-700 px-3 py-2 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Choose a Relic to Trade --</option>
                {myInventory.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    [{item.rarity}] {item.name} ({item.item_type || 'Curio'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-stone-400 mb-1">What would you like in return? (Wanted item description):</label>
            <input
              type="text"
              maxLength={100}
              required
              value={wantedDescription}
              onChange={(e) => setWantedDescription(e.target.value)}
              placeholder="e.g. Any Rare pinecone or moss-covered stone"
              className="w-full bg-stone-950 border border-stone-700 px-3 py-2 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              disabled={creatingOffer || myInventory.length === 0}
              className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-bold text-xs transition-colors cursor-pointer"
            >
              {creatingOffer ? 'Listing Relic...' : 'Post Relic Offer'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Execute Trade Modal / Inline Selector */}
      {selectedOfferForTrade && (
        <form onSubmit={handleExecuteSubmit} className="bg-stone-900 border-2 border-amber-600/80 rounded-3xl p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
              <span>🤝</span> Accept Trade with Goblin Scout
            </h3>
            <button
              type="button"
              onClick={() => setSelectedOfferForTrade(null)}
              className="text-stone-400 hover:text-stone-200 text-xs cursor-pointer font-bold"
            >
              ✕ Close
            </button>
          </div>

          <div className="bg-stone-950/80 p-3 rounded-2xl border border-stone-800 text-xs space-y-1">
            <div className="text-stone-400">Offered Relic: <strong className="text-stone-200">{selectedOfferForTrade.sender_item_name}</strong> ({selectedOfferForTrade.sender_item_rarity})</div>
            <div className="text-amber-400/90">Demanded in return: <em>"{selectedOfferForTrade.wanted_description}"</em></div>
          </div>

          <div>
            <label className="block text-[11px] text-stone-400 mb-1">Select your relic to exchange:</label>
            {myInventory.length === 0 ? (
              <p className="text-xs text-rose-400">You have no items in your treasury to offer!</p>
            ) : (
              <select
                value={callerItemId}
                onChange={(e) => setCallerItemId(e.target.value)}
                required
                className="w-full bg-stone-950 border border-stone-700 px-3 py-2 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">-- Choose Relic to Swap --</option>
                {myInventory.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    [{item.rarity}] {item.name} ({item.item_type || 'Curio'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submittingTrade || !callerItemId}
              className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-stone-950 font-bold text-xs transition-colors cursor-pointer"
            >
              {submittingTrade ? 'Executing Barter...' : 'Confirm & Complete Swap'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedOfferForTrade(null)}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs cursor-pointer"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {/* Browse Open Offers Tab */}
      {activeTab === 'browse' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-stone-400">
              Inspecting trading stalls...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-2xl text-center">
              {error}
            </div>
          ) : offers.length === 0 ? (
            <div className="bg-stone-900/60 border border-stone-800 rounded-3xl p-8 text-center space-y-2">
              <p className="text-sm font-bold text-stone-300">The outpost is quiet today.</p>
              <p className="text-xs text-stone-500">No open trade offers. Be the first to post a relic offer!</p>
            </div>
          ) : (
            offers.map((offer) => {
              const isOwner = user && offer.sender_id === user.id;
              const rarityStyle = RARITY_COLORS[offer.sender_item_rarity] || RARITY_COLORS.Common;

              return (
                <div
                  key={offer.id}
                  className="bg-stone-900/70 border border-stone-800/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-stone-700"
                >
                  <div className="flex items-center gap-3">
                    {offer.sender_item_thumbnail ? (
                      <img
                        src={offer.sender_item_thumbnail}
                        alt={offer.sender_item_name}
                        className="w-14 h-14 rounded-xl object-cover border border-stone-700 bg-stone-950 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl border border-stone-700 bg-stone-950 flex items-center justify-center text-xl shrink-0">
                        📦
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-stone-100">
                          {offer.sender_item_name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rarityStyle}`}>
                          {offer.sender_item_rarity}
                        </span>
                      </div>
                      <p className="text-xs text-amber-300/90">
                        Wants: <span className="text-stone-300 italic">"{offer.wanted_description}"</span>
                      </p>
                      <span className="text-[10px] text-stone-500 block">
                        Listed {new Date(offer.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={() => handleCancel(offer.id)}
                        className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-rose-950 text-rose-300 border border-stone-700 hover:border-rose-700 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancel Offer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) {
                            setActionFeedback({ type: 'error', message: 'Sign in to trade.' });
                            return;
                          }
                          setSelectedOfferForTrade(offer);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Trade For This
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
