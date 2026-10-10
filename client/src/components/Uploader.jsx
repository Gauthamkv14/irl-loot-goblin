import React, { useRef, useState } from 'react';

export default function Uploader({ onImageSelected, disabled }) {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelected(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onImageSelected(file);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Hidden file inputs */}
      {/* 1. Camera input with capture="environment" for smartphones */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      {/* 2. Gallery / File picker input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Atmospheric dropzone container */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 ${
          dragActive
            ? 'border-emerald-500 bg-emerald-950/30 scale-[1.01]'
            : 'border-stone-700 bg-stone-900/60 hover:border-stone-500'
        }`}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-3xl shadow-inner">
          🌿
        </div>

        <h3 className="text-xl font-bold text-emerald-400 mb-1 tracking-wide">
          Present Your Outdoor Find
        </h3>
        <p className="text-sm text-stone-400 mb-6 max-w-xs mx-auto">
          Take a photo of a strange leaf, weathered rock, twig, or relic encountered outside.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 px-5 py-3.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-stone-950 transition-colors shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-lg">📷</span> Snap with Camera
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => galleryInputRef.current?.click()}
            className="flex-1 px-5 py-3.5 rounded-xl font-semibold text-sm bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>📁</span> Choose from Gallery
          </button>
        </div>

        <p className="mt-4 text-xs text-stone-500">
          JPEG, PNG, or WebP • Resized safely on your device • Max 4 MB
        </p>
      </div>
    </div>
  );
}
