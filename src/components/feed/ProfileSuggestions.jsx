import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { Avatar } from '../common/Avatar';
import { Sparkles, UserPlus, MessageSquare, Check, MapPin } from 'lucide-react';

export const ProfileSuggestions = ({ onSelectUser, onOpenChatWithUser }) => {
  const { currentUser, users } = useAuth();
  const { getFriendshipStatus, sendFriendRequest } = useSocial();

  // Exclude current logged in user
  const suggestions = users.filter(u => u.id !== currentUser?.id);

  return (
    <div className="p-4 bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
          <h3 className="text-xs font-extrabold text-[var(--c-text)] uppercase tracking-wider">
            Sugestões de Perfis para Você
          </h3>
        </div>
        <span className="text-[10px] text-[var(--c-accent)] font-semibold">Solteiros & Casais</span>
      </div>

      {/* Horizontal scrollable suggestion cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {suggestions.map(u => {
          const friendStatus = getFriendshipStatus(u.id);

          return (
            <div
              key={u.id}
              className="relative min-w-[210px] bg-[var(--c-surface-3)] border border-[var(--c-border)] hover:border-rose-500/40 rounded-2xl p-3 flex flex-col justify-between flex-shrink-0 transition group shadow-md"
            >
              <div
                onClick={() => onSelectUser(u)}
                className="cursor-pointer space-y-2"
              >
                <div className="relative w-16 h-16 mx-auto">
                  <Avatar
                    src={u.avatar}
                    alt={u.name}
                    isCouple={u.isCouple}
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-rose-500/40 group-hover:scale-105 transition duration-300"
                  />
                  {u.isCouple && (
                    <span className="absolute -bottom-1 -right-1 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-black flex items-center gap-0.5">
                      ❤️ Casal
                    </span>
                  )}
                </div>

                <div className="text-center">
                  <h4 className="text-xs font-bold text-[var(--c-text)] group-hover:text-rose-400 transition truncate flex items-center justify-center gap-1">
                    {u.name}
                  </h4>
                  <p className="text-[10px] text-[var(--c-accent)] truncate mt-0.5">
                    {u.gender} • {u.age} anos
                  </p>
                  <p className="text-[9px] text-[var(--c-text-muted)] flex items-center justify-center gap-0.5 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-rose-400" /> {u.location || 'São Paulo, SP'}
                  </p>
                </div>

              </div>

              {/* Action Button */}
              <div className="mt-3 pt-2 border-t border-[var(--c-border-soft)]">
                {friendStatus === 'ACCEPTED' ? (
                  <button
                    onClick={() => onOpenChatWithUser(u)}
                    className="w-full py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-[var(--c-accent)] border border-rose-500/40 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                ) : friendStatus === 'SENT' ? (
                  <div className="w-full py-1.5 bg-[var(--c-overlay-5)] border border-[var(--c-border)] rounded-xl text-[10px] text-[var(--c-text-muted)] font-medium text-center flex items-center justify-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" /> Enviado
                  </div>
                ) : (
                  <button
                    onClick={() => sendFriendRequest(u.id)}
                    className="w-full py-1.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-[11px] font-bold shadow-md transition flex items-center justify-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Conectar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
