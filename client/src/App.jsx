import React, { useState } from 'react';
import Uploader from './components/Uploader';
import LoadingGoblin from './components/LoadingGoblin';
import LootCard from './components/LootCard';
import ErrorMessage from './components/ErrorMessage';
import { resizeImage } from './lib/resizeImage';

export default function App() {
  const [status, setStatus] = useState('idle'); // idle | resizing | appraising | success | error
  const [previewUrl, setPreviewUrl] = useState(null);
  const [lootItem, setLootItem] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Handle selected image file
  const handleImageSelected = async (file) => {
    if (status === 'resizing' || status === 'appraising') return;

    setStatus('resizing');
    setErrorMessage(null);
    setLootItem(null);

    let resizeResult = null;
    try {
      resizeResult = await resizeImage(file, 1024, 0.8);
      setPreviewUrl(resizeResult.previewUrl);
    } catch (resizeErr) {
      setStatus('error');
      setErrorMessage(resizeErr.message);
      return;
    }

    // Now send resized image to backend
    setStatus('appraising');

    const formData = new FormData();
    formData.append('image', resizeResult.blob, 'find.jpg');

    const controller = new AbortController();
    // 60-second timeout matching backend upper bound
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
          // ignore JSON parse error
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

  const handleReset = () => {
    setStatus('idle');
    setPreviewUrl(null);
    setLootItem(null);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#0c0e0c] text-stone-200 flex flex-col items-center justify-between p-4 sm:p-6 selection:bg-emerald-900 selection:text-emerald-100">
      {/* Atmosphere Header */}
      <header className="w-full max-w-lg mx-auto text-center pt-4 pb-6">
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
        {status === 'idle' && (
          <Uploader onImageSelected={handleImageSelected} disabled={false} />
        )}

        {(status === 'resizing' || status === 'appraising') && (
          <LoadingGoblin previewUrl={previewUrl} />
        )}

        {status === 'success' && (
          <LootCard
            item={lootItem}
            previewUrl={previewUrl}
            onReset={handleReset}
          />
        )}

        {status === 'error' && (
          <ErrorMessage
            error={errorMessage}
            onRetry={handleReset}
          />
        )}
      </main>

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
