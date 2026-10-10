import React, { useState } from 'react';
import LootCard from './LootCard';

const RARITY_ORDER = {
  All: 0,
  Legendary: 5,
  Epic: 4,
  Rare: 3,
  Uncommon: 2,
  Common: 1
};

export default function InventoryView({ items, loading, error, onRefresh, onAppraiseNew }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterRarity, setFilterRarity] = useState('All');
  const [sortBy, setSortBy] = useState('newest'); // newest | value | rarity

  // Filter items
  const filtered = items.filter((it) => {
    if (filterRarity === 'All') return true;
    return it.rarity === filterRarity;
  });

  // Sort items
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
    }
    if (sortBy === 'value') {
      return (b.goblin_value || 0) - (a.goblin_value || 0);
    }
    if (sortBy === 'rarity') {
      return (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0);
    }
    return 0;
  });

  const totalCoins = items.reduce((sum, it) => sum + (it.goblin_value || 0), 0);

  if (selectedItem) {
    return (
      <div className="w-full max-w-lg mx-auto py-2">
        <button
          type="button"
          onClick={() => setSelectedItem(null)}
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-stone-900 border border-stone-700 text-stone-300 hover:text-stone-100 hover:border-stone-500 cursor-pointer"
        >
          ← Back to Treasury
        </button>
        <LootCard
          item={selectedItem}
          previewUrl={selectedItem.thumbnail || null}
          onReset={() => setSelectedItem(null)}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto py-2 space-y-6">
      {/* Treasury Banner */}
      <div className="bg-stone-900/80 border border-emerald-900/60 rounded-3xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider text-stone-400 font-semibold block">
            Goblin Treasury
          </span>
          <div className="text-2xl font-black text-amber-400 flex items-center gap-2 mt-0.5">
            <span>🪙</span> {totalCoins.toLocaleString()}{' '}
            <span className="text-xs font-medium text-amber-300/80">Coins</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs uppercase tracking-wider text-stone-400 font-semibold block">
            Hoarded Finds
          </span>
          <div className="text-xl font-bold text-stone-100 mt-0.5">
            {items.length} <span className="text-xs font-normal text-stone-400">items</span>
          </div>
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-stone-950/60 p-3 rounded-2xl border border-stone-800">
        {/* Rarity filter pills */}
        <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start w-full sm:w-auto">
          {['All', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'].map((rarity) => (
            <button
              key={rarity}
              type="button"
              onClick={() => setFilterRarity(rarity)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterRarity === rarity
                  ? 'bg-emerald-600 text-stone-950 shadow-sm'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {rarity}
            </button>
          ))}
        </div>

        {/* Sort select */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-stone-400">
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-stone-900 border border-stone-700 text-stone-200 px-2 py-1 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer text-xs"
          >
            <option value="newest">Newest First</option>
            <option value="value">Highest Value</option>
            <option value="rarity">Highest Rarity</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-12 text-center text-stone-400">
          <div className="inline-block animate-spin text-3xl mb-3">🪙</div>
          <p className="text-sm font-medium">Opening heavy vault doors...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800/80 text-center">
          <p className="text-xs text-rose-300 mb-3">{error}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-stone-800 text-stone-200 border border-stone-600 hover:bg-stone-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="py-14 px-6 text-center bg-stone-900/50 border border-dashed border-stone-800 rounded-3xl">
          <div className="text-4xl mb-3">🧺</div>
          <h4 className="text-lg font-bold text-stone-200 mb-1">
            Your Pockets Contain Only Disappointment
          </h4>
          <p className="text-xs text-stone-400 max-w-xs mx-auto mb-5 leading-relaxed">
            You haven't hoarded any outdoor relics yet. Go outside, touch grass, and photograph your first curious find!
          </p>
          <button
            type="button"
            onClick={onAppraiseNew}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-stone-950 transition-colors shadow-lg cursor-pointer"
          >
            Appraise Your First Item
          </button>
        </div>
      )}

      {/* Grid of Items */}
      {!loading && !error && sorted.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sorted.map((item) => {
            const isFallback = item.source === 'fallback';
            const rarity = item.rarity || 'Common';
            const rarityBorder = {
              Common: 'border-slate-700 hover:border-slate-500',
              Uncommon: 'border-emerald-800 hover:border-emerald-500',
              Rare: 'border-blue-800 hover:border-blue-500',
              Epic: 'border-purple-800 hover:border-purple-500',
              Legendary: 'border-amber-700 hover:border-amber-400'
            }[rarity] || 'border-stone-800';

            return (
              <div
                key={item.id || item.item_id}
                onClick={() => setSelectedItem(item)}
                className={`group relative bg-stone-900/90 border-2 ${rarityBorder} rounded-2xl p-3 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-[1.02] shadow-md`}
              >
                {/* Thumbnail if present, or generic icon */}
                <div className="w-full aspect-square rounded-xl bg-stone-950/80 mb-2 overflow-hidden flex items-center justify-center border border-stone-800 relative">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <span className="text-3xl">🏺</span>
                  )}

                  {isFallback && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/90 text-rose-300 border border-rose-800">
                      Fallback
                    </span>
                  )}
                </div>

                {/* Item Details */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
                    {item.rarity}
                  </span>
                  <h5 className="text-xs font-bold text-stone-100 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                    {item.name}
                  </h5>
                  <div className="mt-1 text-[11px] font-extrabold text-amber-400 flex items-center gap-1">
                    <span>🪙</span> {item.goblin_value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
