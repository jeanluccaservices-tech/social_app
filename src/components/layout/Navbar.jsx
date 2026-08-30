import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../common/Avatar';
import { SupportButton } from '../common/SupportButton';
import { TermsModal } from '../common/TermsModal';
import { BlockedUsersModal } from '../profile/BlockedUsersModal';
import { NotificationsBell } from './NotificationsBell';
import { Heart, Sparkles, LogOut, Sun, Moon, Loader2, MoreVertical, ScrollText, Ban } from 'lucide-react';

export const Navbar = ({ onOpenProfile, onOpenFriends }) => {
  const { currentUser, setIsAuthModalOpen, setIsProModalOpen, logout, loggingOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the overflow menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  return (
    <>
    <header className="sticky top-0 z-50 bg-[var(--c-surface-2)]/90 backdrop-blur-xl border-b border-rose-500/20 px-3 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Heart className="w-5 h-5 text-[var(--c-text)] fill-current animate-pulse" />
          </div>
          <div>
            <h1 className="font-display text-lg lg:text-xl font-semibold italic text-[var(--c-text)] tracking-wide flex items-center gap-1">
              Love<span className="text-rose-500">Vibe</span>
            </h1>
            <p className="text-[9px] text-[var(--c-accent)] hidden sm:block font-medium">Rede Social de Relacionamentos</p>
          </div>
        </div>

        {/* Right Section Actions */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {currentUser && <NotificationsBell onOpenProfile={onOpenProfile} onOpenFriends={onOpenFriends} />}

          {/* PRO Badge / Upgrade Button */}
          {currentUser ? (
            currentUser.isPro ? (
              <div
                onClick={() => setIsProModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 rounded-xl text-[var(--c-pro-text)] text-xs font-bold shadow-lg shadow-amber-500/10 cursor-pointer hover:bg-amber-500/30 transition"
              >
                <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400 animate-spin-slow" />
                <span className="hidden sm:inline">VIP</span>
              </div>
            ) : (
              <button
                onClick={() => setIsProModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition transform hover:scale-105 active:scale-95"
              >
                <Sparkles className="w-4 h-4 fill-black" />
                <span className="hidden sm:inline">Virar VIP</span>
              </button>
            )
          ) : null}

          {/* User Auth Profile */}
          {currentUser ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 p-1 pl-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] border border-[var(--c-border)] rounded-full transition"
            >
              <Avatar
                src={currentUser.avatar}
                alt={currentUser.name}
                isCouple={currentUser.isCouple}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-rose-500/50"
              />
              <span className="text-xs font-bold text-[var(--c-text)] pr-2 hidden lg:inline max-w-[100px] truncate">
                {currentUser.name}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition"
            >
              Entrar / Cadastrar
            </button>
          )}

          {/* Overflow menu: support, theme toggle, and logout live here so
              the header stays compact on mobile instead of overflowing. */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              title="Mais opções"
              className="p-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] border border-[var(--c-border)] rounded-xl text-[var(--c-text-secondary)] transition"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-2xl shadow-black/20 overflow-hidden z-50">
                <button
                  onClick={() => { toggleTheme(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] transition text-left"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-[var(--c-accent)]" /> : <Moon className="w-4 h-4 text-[var(--c-accent)]" />}
                  {theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                </button>

                <SupportButton
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] transition"
                  onClick={() => setMenuOpen(false)}
                />

                <button
                  onClick={() => { setIsTermsModalOpen(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] transition text-left"
                >
                  <ScrollText className="w-4 h-4 text-[var(--c-accent)]" /> Termos de Uso
                </button>

                {currentUser && (
                  <>
                    <button
                      onClick={() => { setIsBlockedModalOpen(true); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] transition text-left"
                    >
                      <Ban className="w-4 h-4 text-[var(--c-accent)]" /> Perfis Bloqueados
                    </button>

                    <div className="h-px bg-[var(--c-border)]" />
                    <button
                      onClick={() => { setMenuOpen(false); logout(); }}
                      disabled={loggingOut}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition text-left disabled:opacity-60"
                    >
                      {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                      Sair da conta
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    <TermsModal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} />
    {currentUser && <BlockedUsersModal isOpen={isBlockedModalOpen} onClose={() => setIsBlockedModalOpen(false)} />}
    </>
  );
};
