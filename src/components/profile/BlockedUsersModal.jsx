import React, { useEffect, useState } from 'react';
import { useSocial } from '../../context/SocialContext';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../common/Avatar';
import { X, Ban, ShieldOff, Loader2 } from 'lucide-react';

export const BlockedUsersModal = ({ isOpen, onClose }) => {
  const { blockedProfiles, fetchBlockedProfiles, unblockUser } = useSocial();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchBlockedProfiles().finally(() => setLoading(false));
  }, [isOpen, fetchBlockedProfiles]);

  if (!isOpen) return null;

  const handleUnblock = async (targetUser) => {
    setUnblockingId(targetUser.id);
    const success = await unblockUser(targetUser.id);
    setUnblockingId(null);
    showToast(success ? `${targetUser.name} foi desbloqueado(a).` : 'Não foi possível desbloquear agora.', success ? 'success' : 'error');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md bg-[var(--c-surface)] border border-rose-500/30 rounded-3xl shadow-2xl shadow-rose-950/50 overflow-hidden my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-[var(--c-text-muted)] hover:text-[var(--c-text)] p-2 rounded-full hover:bg-[var(--c-overlay-10)] transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-4">
          <h2 className="text-lg font-bold text-[var(--c-text)] flex items-center gap-2">
            <Ban className="w-5 h-5 text-rose-500" /> Perfis Bloqueados
          </h2>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">
            Pessoas que você bloqueou não veem seu perfil, publicações ou mensagens, e você não vê os delas.
          </p>
        </div>

        <div className="px-4 pb-6 space-y-2 max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-[var(--c-text-muted)]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : blockedProfiles.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <ShieldOff className="w-8 h-8 text-[var(--c-text-faint)] mx-auto" />
              <p className="text-xs text-[var(--c-text-muted)] font-semibold">Você não bloqueou nenhum perfil.</p>
            </div>
          ) : (
            blockedProfiles.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 p-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-2xl">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Avatar src={u.avatar} alt={u.name} isCouple={u.isCouple} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-[var(--c-text)] truncate">{u.name}</p>
                    <p className="text-[10px] text-[var(--c-accent)] truncate">@{u.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(u)}
                  disabled={unblockingId === u.id}
                  className="px-3 py-1.5 bg-[var(--c-overlay-5)] hover:bg-rose-500/20 text-[var(--c-text-secondary)] hover:text-rose-400 border border-[var(--c-border)] rounded-xl text-[11px] font-bold transition disabled:opacity-60 flex-shrink-0 flex items-center gap-1.5"
                >
                  {unblockingId === u.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Desbloquear
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
