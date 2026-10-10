import React from 'react';

export default function QuestView({
  dailyQuests = [],
  hunts = [],
  loading = false,
  error = null,
  onRefresh,
  onAppraiseNew,
  user
}) {
  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto py-12 text-center space-y-4">
        <div className="text-4xl animate-bounce">📜</div>
        <p className="text-sm font-semibold text-stone-300">Consulting the Goblin Quest Scrolls...</p>
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

  return (
    <div className="w-full max-w-lg mx-auto py-2 space-y-8">
      {/* Header Banner */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-5 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📜</span>
            <h2 className="text-lg font-extrabold text-stone-100">Exploration Quests</h2>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
            Resets Daily (UTC)
          </span>
        </div>
        <p className="text-xs text-stone-400 leading-relaxed">
          Complete daily challenges and themed scavenger checklists by discovering and hoarding outdoor relics. All rewards are certified server-side.
        </p>
      </div>

      {/* Section 1: Daily Quests */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <span>☀️</span> Today's Daily Quests
          </h3>
          <span className="text-xs text-stone-400 font-mono">
            {dailyQuests.filter(q => q.completed).length} / {dailyQuests.length} Done
          </span>
        </div>

        {dailyQuests.length === 0 ? (
          <div className="bg-stone-950/60 border border-stone-800 rounded-2xl p-6 text-center text-xs text-stone-400">
            No active quests available. Check back tomorrow!
          </div>
        ) : (
          <div className="space-y-3">
            {dailyQuests.map((quest) => (
              <div
                key={quest.id}
                className={`p-4 rounded-2xl border transition-all ${
                  quest.completed
                    ? 'bg-emerald-950/40 border-emerald-800/80'
                    : 'bg-stone-900/80 border-stone-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-stone-200 flex items-center gap-2">
                      {quest.title}
                      {quest.completed && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-600 font-semibold">
                          ✓ Completed
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-stone-400 mt-0.5">{quest.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block text-xs font-mono font-bold text-amber-400">
                      +{quest.xpReward} XP
                    </span>
                    <span className="block text-[11px] font-mono text-stone-400">
                      +{quest.coinReward} 🪙
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-stone-950 rounded-full h-2 overflow-hidden border border-stone-800 mt-3">
                  <div
                    className={`h-full transition-all duration-500 ${
                      quest.completed ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((quest.progress / quest.target) * 100))}%`
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-stone-400 font-mono mt-1.5">
                  <span>Progress: {quest.progress} / {quest.target}</span>
                  <span>{Math.min(100, Math.round((quest.progress / quest.target) * 100))}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Curated Scavenger Hunts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <span>🧭</span> Scavenger Hunts
          </h3>
          <span className="text-xs text-stone-400 font-mono">
            Themed Checklists
          </span>
        </div>

        <div className="space-y-4">
          {hunts.map((hunt) => (
            <div
              key={hunt.id}
              className={`p-5 rounded-3xl border transition-all ${
                hunt.isCompleted
                  ? 'bg-amber-950/30 border-amber-800/80'
                  : 'bg-stone-900/80 border-stone-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                    {hunt.title}
                    {hunt.isCompleted && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/80 text-amber-300 border border-amber-600 font-semibold">
                        ★ Mastered
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5">{hunt.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block text-xs font-mono font-bold text-amber-400">
                    +{hunt.rewardXp} XP
                  </span>
                  <span className="block text-[11px] font-mono text-stone-400">
                    +{hunt.rewardCoins} 🪙
                  </span>
                </div>
              </div>

              {/* Objectives List */}
              <div className="space-y-2 mt-4 pt-3 border-t border-stone-800/80">
                {hunt.objectives.map((obj) => (
                  <div
                    key={obj.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      obj.completed
                        ? 'bg-emerald-950/50 border-emerald-800/70 text-emerald-200'
                        : 'bg-stone-950/70 border-stone-800/80 text-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm">
                        {obj.completed ? '✅' : '⭕'}
                      </span>
                      <div>
                        <span className="font-semibold block">{obj.label}</span>
                        <span className="text-[11px] text-stone-400">{obj.hint}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono shrink-0">
                      {obj.completed ? '+30 XP' : 'Incomplete'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onAppraiseNew}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-stone-950 transition-colors shadow-lg shadow-emerald-950/50 cursor-pointer"
        >
          🔍 Appraise Something to Make Progress
        </button>
      </div>
    </div>
  );
}
