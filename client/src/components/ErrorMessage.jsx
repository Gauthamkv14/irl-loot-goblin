import React from 'react';

export default function ErrorMessage({ error, onRetry }) {
  return (
    <div className="w-full max-w-md mx-auto bg-stone-900 border border-rose-900/80 rounded-2xl p-6 text-center shadow-xl">
      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-rose-950/70 border border-rose-800 flex items-center justify-center text-3xl">
        🧌
      </div>

      <h3 className="text-xl font-bold text-rose-400 mb-2">
        Goblin Appraisal Disrupted
      </h3>

      <p className="text-sm text-stone-300 mb-6 bg-stone-950/60 p-3 rounded-xl border border-stone-800 text-left">
        {error || 'An unexpected disturbance occurred while appraising your find.'}
      </p>

      <div className="flex gap-3 justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-3 rounded-xl font-bold text-sm bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <span>↺</span> Try Another Photo
        </button>
      </div>
    </div>
  );
}
