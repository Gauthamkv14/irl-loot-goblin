import React from 'react';

const RARITY_THEMES = {
  Common: {
    border: 'border-slate-500',
    bg: 'bg-slate-950/80',
    text: 'text-slate-300',
    badgeBg: 'bg-slate-800 text-slate-200 border-slate-600',
    glow: 'glow-common'
  },
  Uncommon: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-950/80',
    text: 'text-emerald-400',
    badgeBg: 'bg-emerald-900/80 text-emerald-200 border-emerald-600',
    glow: 'glow-uncommon'
  },
  Rare: {
    border: 'border-blue-500',
    bg: 'bg-blue-950/80',
    text: 'text-blue-400',
    badgeBg: 'bg-blue-900/80 text-blue-200 border-blue-600',
    glow: 'glow-rare'
  },
  Epic: {
    border: 'border-purple-500',
    bg: 'bg-purple-950/80',
    text: 'text-purple-300',
    badgeBg: 'bg-purple-900/80 text-purple-200 border-purple-600',
    glow: 'glow-epic'
  },
  Legendary: {
    border: 'border-amber-400',
    bg: 'bg-amber-950/80',
    text: 'text-amber-300',
    badgeBg: 'bg-amber-900/80 text-amber-200 border-amber-500',
    glow: 'glow-legendary'
  }
};

export default function LootCard({
  item,
  previewUrl,
  onReset,
  onSave,
  isSaved,
  isSaving,
  user
}) {
  if (!item) return null;

  const rarity = item.rarity || 'Common';
  const theme = RARITY_THEMES[rarity] || RARITY_THEMES.Common;
  const isFallback = item.source === 'fallback';

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* RPG Card Container with Rarity Border and Glow */}
      <div
        className={`relative rounded-3xl border-2 ${theme.border} ${theme.glow} bg-stone-900/95 overflow-hidden shadow-2xl transition-all duration-300`}
      >
        {/* Top Header Banner: Rarity, Type, and Fallback / Certified Badges */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${theme.badgeBg}`}
            >
              ★ {rarity}
            </span>
            <span className="text-xs text-stone-400 font-medium">
              {item.item_type}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isFallback ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/90 text-rose-300 border border-rose-700/80">
                ⚠ Demo Fallback
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80">
                ✓ Certified Appraisal
              </span>
            )}
            <span
              className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-700`}
              title={`Visual confidence: ${item.confidence}`}
            >
              {item.confidence} conf.
            </span>
          </div>
        </div>

        {/* Card Body: Photo + Identity */}
        <div className="p-5 space-y-5">
          {/* Photo & Grounded Observation */}
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start bg-stone-950/70 p-3.5 rounded-2xl border border-stone-800">
            {previewUrl && (
              <div className="w-28 h-28 shrink-0 rounded-xl overflow-hidden border border-stone-700 shadow-md">
                <img
                  src={previewUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 text-left">
              <span className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold block mb-1">
                Visual Inspection:
              </span>
              <p className="text-xs text-stone-300 leading-relaxed italic">
                "{item.observed_object}"
              </p>
            </div>
          </div>

          {/* Item Name */}
          <div className="text-center pt-1 pb-2">
            <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${theme.text}`}>
              {item.name}
            </h2>
          </div>

          {/* Stat Budget Badges */}
          {item.stats && Object.keys(item.stats).length > 0 && (
            <div className="bg-stone-950/50 p-3.5 rounded-xl border border-stone-800/80">
              <span className="text-[11px] uppercase tracking-wider text-stone-500 font-bold block mb-2 text-center">
                Governing Attributes
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {Object.entries(item.stats).map(([statName, val]) => (
                  <div
                    key={statName}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 shadow-sm"
                  >
                    <span className="text-xs font-bold text-stone-400 font-mono">
                      {statName}
                    </span>
                    <span className="text-sm font-extrabold text-amber-400">
                      +{val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Special Ability */}
          <div className="p-3.5 rounded-xl bg-stone-800/40 border border-stone-700/60 text-left">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">⚡</span>
              <span className="text-sm font-bold text-amber-300">
                {item.ability_name}
              </span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed pl-5">
              {item.ability_description}
            </p>
          </div>

          {/* Lore Section */}
          <div className="p-3.5 rounded-xl bg-stone-950/40 border border-stone-800/60 text-left">
            <span className="text-[11px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
              Woodland Lore
            </span>
            <p className="text-xs text-stone-300/90 leading-relaxed">
              {item.lore}
            </p>
          </div>

          {/* Goblin Appraiser Quote */}
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-900/50 text-left">
            <span className="text-[11px] uppercase tracking-wider text-emerald-500/90 font-bold block mb-1">
              Appraiser's Notes
            </span>
            <p className="text-xs text-emerald-200/90 italic leading-relaxed">
              "{item.appraisal}"
            </p>
          </div>

          {/* Valuation in Goblin Coins */}
          <div className="pt-2 pb-1 flex items-center justify-between px-4 py-3 bg-amber-950/30 border border-amber-900/50 rounded-xl">
            <div>
              <span className="text-xs text-stone-400 block font-medium">
                Market Value (Imaginary)
              </span>
              <span className="text-lg font-black text-amber-400 flex items-center gap-1.5">
                <span>🪙</span> {item.goblin_value} <span className="text-xs font-semibold text-amber-300/80">Goblin Coins</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-stone-500 block">Cert ID</span>
              <span className="text-xs font-mono text-stone-400">
                {item.id?.substring(0, 14)}...
              </span>
            </div>
          </div>

          {/* Safety & Fictional Disclaimer */}
          <p className="text-[10px] text-stone-500 text-center px-4 leading-normal">
            {item.disclaimer || 'Certified Goblin Appraisal. Fictional RPG item; observe in nature, do not collect or disturb.'}
          </p>
        </div>

        {/* Footer Actions: Save to Inventory & Appraise Another */}
        <div className="p-4 bg-stone-950/90 border-t border-stone-800 flex flex-col sm:flex-row gap-3 justify-center">
          {onSave && (
            <button
              type="button"
              disabled={isSaving || isSaved}
              onClick={onSave}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                isSaved
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-stone-950 shadow-emerald-950/50'
              } disabled:opacity-50`}
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">🪙</span> Hoarding...
                </>
              ) : isSaved ? (
                <>
                  <span>✓</span> Saved in Treasury
                </>
              ) : (
                <>
                  <span>💾</span> {user ? 'Save to Treasury' : 'Sign in to Save'}
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onReset}
            className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-sm bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg"
          >
            <span>🔄</span> Appraise Another Find
          </button>
        </div>
      </div>
    </div>
  );
}
