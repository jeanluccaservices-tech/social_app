import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Heart, LogIn } from 'lucide-react';

// Shown instead of the app whenever there's no session — profiles, posts
// and everyone's photos are private to logged-in members, so a visitor
// gets this instead of a peek at the feed.
export const LoginGate = () => {
  const { setIsAuthModalOpen } = useAuth();

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-600/30">
        <Heart className="w-8 h-8 text-white fill-current animate-pulse" />
      </div>
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold italic text-[var(--c-text)] tracking-tight">
          Love<span className="text-rose-500">Vibe</span>
        </h1>
        <p className="text-sm text-[var(--c-accent)] max-w-sm">
          Entre na sua conta ou cadastre-se para ver o feed, conversar e conhecer pessoas.
        </p>
      </div>
      <button
        onClick={() => setIsAuthModalOpen(true)}
        className="px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
      >
        <LogIn className="w-4 h-4" /> Entrar / Cadastrar
      </button>
    </div>
  );
};
