import React from 'react';
import { X } from 'lucide-react';

// Full-screen photo viewer used by the profile's Media tab.
export const MediaLightbox = ({ src, onClose }) => {
  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt="Mídia ampliada"
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
      />
    </div>
  );
};
