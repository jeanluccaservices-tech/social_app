import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Sparkles } from 'lucide-react';

export const ChatLockBanner = () => {
  const { setIsProModalOpen } = useAuth();

  return (
    <div className="p-3 bg-gradient-to-r from-amber-950/60 to-rose-950/60 border-t border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-2">
      <p className="text-[11px] text-[var(--c-pro-text)] font-semibold flex items-center gap-1.5 text-center sm:text-left">
        <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        Apenas membros <strong className="text-[var(--c-pro-text)]">VIP</strong> podem enviar mensagens.
      </p>
      <button
        onClick={() => setIsProModalOpen(true)}
        className="flex-shrink-0 px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-[11px] rounded-xl shadow-md transition flex items-center gap-1.5"
      >
        <Sparkles className="w-3.5 h-3.5 fill-black" /> Virar VIP
      </button>
    </div>
  );
};
