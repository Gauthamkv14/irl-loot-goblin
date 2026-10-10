import React, { useState, useEffect } from 'react';

const GOBLIN_MESSAGES = [
  'The goblin is squinting intently at your object...',
  'Checking for ancient curses and suspicious moss...',
  'Sniffing the texture for woodland authenticity...',
  'Consulting the sacred goblin registry of curious rocks...',
  'Calculating imaginary market value in Goblin Coins...',
  'Polishing magnifying glass on ragged sleeve...',
  'Conferring with nearby subterranean spirits...',
  'Almost ready... scribbling dramatic lore onto parchment...'
];

export default function LoadingGoblin({ previewUrl }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % GOBLIN_MESSAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto bg-stone-900/90 border border-emerald-900/70 rounded-2xl p-6 text-center shadow-xl shadow-black/60">
      {/* Photo preview with squinting overlay */}
      {previewUrl && (
        <div className="relative w-48 h-48 mx-auto mb-6 rounded-xl overflow-hidden border-2 border-stone-700 shadow-md">
          <img
            src={previewUrl}
            alt="Candidate find"
            className="w-full h-full object-cover filter brightness-75 contrast-110"
          />
          <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-4xl animate-bounce">🔍</span>
          </div>
        </div>
      )}

      {/* Goblin Icon with pulse */}
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950 border border-emerald-500/50 text-3xl mb-4 animate-pulse">
        👺
      </div>

      <h3 className="text-xl font-bold text-emerald-400 mb-2">
        Appraisal in Progress
      </h3>

      {/* Rotating playful message */}
      <p className="text-sm font-medium text-amber-200/90 min-h-[44px] flex items-center justify-center px-4 transition-opacity duration-300">
        "{GOBLIN_MESSAGES[msgIndex]}"
      </p>

      {/* Progress indicators */}
      <div className="mt-5 w-48 mx-auto bg-stone-800 rounded-full h-1.5 overflow-hidden border border-stone-700">
        <div className="h-full bg-emerald-500 rounded-full animate-indeterminate"></div>
      </div>

      <p className="mt-3 text-xs text-stone-500">
        Vision appraisal typically takes 15–25 seconds. Please do not close this window.
      </p>
    </div>
  );
}
