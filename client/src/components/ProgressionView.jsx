import React from 'react';

export default function ProgressionView({
  progression = null,
  achievements = [],
  loading = false,
  error = null,
  onRefresh,
  user
}) {
  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto py-12 text-center space-y-4">
        <div className="text-4xl animate-spin">🪙</div>
        <p className="text-sm font-semibold text-stone-300">Calculating Goblin Notoriety...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg mx-auto py-8 text-center bg-rose-950/40 border border-rose-800/80 rounded-2xl p-6 space-y-3">
        <p className="text-sm text-rose-300 font-semibold">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-xl cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const {
    xp = 0,
    level = 1,
    currentLevelXp = 0,
    nextLevelXp = 100,
    xpInCurrentLevel = 0,
    xpNeededForNextLevel = 100,
    progressPercent = 0,
    coins = 0
  } = progression || {};

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="w-full max-w-lg mx-auto py-2 space-y-8">
      {/* Player Identity Card */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-950/80 border-2 border-amber-500 flex items-center justify-center text-3xl shadow-lg">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-stone-100">
                  {user?.user_metadata?.username || user?.email?.split('@')[0] || 'Goblin Scout'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-900/80 text-amber-300 border border-amber-700">
                  LVL {level}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">Relic Hoarder & Field Explorer</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-stone-400 block font-mono">Treasury Coins</span>
            <span className="text-lg font-black text-amber-400 font-mono flex items-center gap-1 justify-end">
              <span>🪙</span> {coins}
            </span>
          </div>
        </div>

        {/* Level Progression Bar */}
        <div className="space-y-1.5 mt-5 pt-4 border-t border-stone-800/80">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-stone-300 font-semibold">Level {level}</span>
            <span className="text-amber-400 font-bold">{xpInCurrentLevel} / {xpNeededForNextLevel} XP</span>
            <span className="text-stone-400">Level {level + 1}</span>
          </div>
          <div className="w-full bg-stone-950 rounded-full h-3 overflow-hidden border border-stone-800">
            <div
              className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-emerald-400 transition-all duration-700 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-stone-400 font-mono">
            <span>Total XP: {xp}</span>
            <span>{progressPercent}% to next rank</span>
          </div>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <span>🏆</span> Goblin Achievements
          </h3>
          <span className="text-xs text-stone-400 font-mono">
            {unlockedCount} / {achievements.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                ach.unlocked
                  ? 'bg-amber-950/30 border-amber-800/80 shadow-md'
                  : 'bg-stone-900/60 border-stone-800/70 opacity-75'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${
                  ach.unlocked
                    ? 'bg-amber-900/60 border-amber-600 text-amber-200 shadow'
                    : 'bg-stone-950 border-stone-800 grayscale'
                }`}
              >
                {ach.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2 truncate">
                    {ach.title}
                  </h4>
                  <span className="text-xs font-mono font-bold text-amber-400 shrink-0">
                    +{ach.xpReward} XP
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                  {ach.description}
                </p>
                {ach.unlocked && (
                  <span className="inline-block mt-2 text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    ✓ Unlocked {ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
