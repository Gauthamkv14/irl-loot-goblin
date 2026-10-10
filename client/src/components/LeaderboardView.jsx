import React, { useState } from 'react';

export default function LeaderboardView({
  leaderboard = [],
  category = 'xp',
  onSelectCategory,
  loading = false,
  error = null,
  page = 1,
  totalCount = 0,
  onPageChange,
  isPublic = false,
  publicTitle = 'Apprentice Forager',
  onUpdatePrivacy,
  user
}) {
  const [privacyToggling, setPrivacyToggling] = useState(false);
  const [customTitle, setCustomTitle] = useState(publicTitle);
  const [titleEditing, setTitleEditing] = useState(false);

  const handleTogglePrivacy = async () => {
    if (privacyToggling) return;
    setPrivacyToggling(true);
    try {
      await onUpdatePrivacy(!isPublic, customTitle);
    } finally {
      setPrivacyToggling(false);
    }
  };

  const handleSaveTitle = async (e) => {
    e.preventDefault();
    setPrivacyToggling(true);
    try {
      await onUpdatePrivacy(isPublic, customTitle);
      setTitleEditing(false);
    } finally {
      setPrivacyToggling(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto py-2 space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h2 className="text-lg font-extrabold text-stone-100">Goblin Hall of Fame</h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
            Public Rankings
          </span>
        </div>
        <p className="text-xs text-stone-400 leading-relaxed">
          Celebrate top foragers and relic hoarders. Profiles are completely private by default until you opt-in.
        </p>

        {/* User Privacy & Opt-In Control */}
        {user && (
          <div className="pt-3 border-t border-stone-800/80 space-y-3">
            <div className="flex items-center justify-between gap-3 bg-stone-950/70 p-3 rounded-2xl border border-stone-800">
              <div>
                <span className="text-xs font-bold text-stone-200 block">
                  Public Profile Opt-In
                </span>
                <span className="text-[11px] text-stone-400">
                  {isPublic ? 'Your display name, rank, and score are visible to others' : 'Your profile is private (hidden from leaderboards)'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleTogglePrivacy}
                disabled={privacyToggling}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-colors ${
                  isPublic
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 hover:bg-emerald-900'
                    : 'bg-stone-800 text-stone-300 border border-stone-700 hover:bg-stone-700'
                }`}
              >
                {privacyToggling ? 'Saving...' : isPublic ? '✓ Public' : '🔒 Private'}
              </button>
            </div>

            {isPublic && (
              <div className="bg-stone-950/40 p-3 rounded-2xl border border-stone-800/80">
                {titleEditing ? (
                  <form onSubmit={handleSaveTitle} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={30}
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g. Master Moss Forager"
                      className="flex-1 bg-stone-900 border border-stone-700 px-3 py-1.5 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={privacyToggling}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Title: <strong className="text-amber-300">{publicTitle}</strong></span>
                    <button
                      type="button"
                      onClick={() => setTitleEditing(true)}
                      className="text-[11px] text-stone-400 hover:text-stone-200 underline cursor-pointer"
                    >
                      Change Title
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 p-1 bg-stone-950/80 rounded-2xl border border-stone-800">
        <button
          type="button"
          onClick={() => onSelectCategory('xp')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            category === 'xp'
              ? 'bg-stone-800 text-amber-400 border border-stone-700 shadow-sm'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          ⚡ XP & Levels
        </button>
        <button
          type="button"
          onClick={() => onSelectCategory('hoard')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            category === 'hoard'
              ? 'bg-stone-800 text-emerald-400 border border-stone-700 shadow-sm'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          🧺 Relics Hoarded
        </button>
        <button
          type="button"
          onClick={() => onSelectCategory('achievements')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            category === 'achievements'
              ? 'bg-stone-800 text-purple-400 border border-stone-700 shadow-sm'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          📜 Achievements
        </button>
      </div>

      {/* Leaderboard Table / Rankings */}
      {loading ? (
        <div className="py-12 text-center text-sm font-semibold text-stone-400">
          Gathering ranking scrolls...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-2xl text-center">
          {error}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="bg-stone-900/60 border border-stone-800 rounded-3xl p-8 text-center space-y-2">
          <p className="text-sm font-bold text-stone-300">No public hoarders on this leaderboard yet.</p>
          <p className="text-xs text-stone-500">Opt in above to become the first registered scout in the Hall of Fame!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, idx) => {
            const rank = (page - 1) * 15 + idx + 1;
            const isTop3 = rank <= 3;
            const rankMedal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

            return (
              <div
                key={entry.user_id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                  isTop3
                    ? 'bg-stone-900/90 border-amber-800/60 shadow-md'
                    : 'bg-stone-900/60 border-stone-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 text-center font-mono font-bold text-sm ${
                    rank === 1 ? 'text-amber-300' : rank === 2 ? 'text-stone-300' : rank === 3 ? 'text-amber-600' : 'text-stone-500'
                  }`}>
                    {rankMedal}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-stone-200">
                        {entry.display_name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-md bg-stone-800 text-[10px] font-mono text-amber-400">
                        LVL {entry.level}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500 block">
                      {entry.public_title}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  {category === 'hoard' ? (
                    <span className="text-xs font-bold text-emerald-400">
                      {entry.total_hoarded} Relics
                    </span>
                  ) : category === 'achievements' ? (
                    <span className="text-xs font-bold text-purple-400">
                      {entry.achievements_unlocked} Unlocked
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400">
                      {entry.xp} XP
                    </span>
                  )}
                  <span className="text-[10px] text-stone-500 block">
                    {entry.goblin_coins} 🪙
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
