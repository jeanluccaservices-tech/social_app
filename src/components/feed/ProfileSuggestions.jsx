import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { useToast } from '../../context/ToastContext';
import { isWithinRadius } from '../../lib/geo';
import { Avatar } from '../common/Avatar';
import { Sparkles, UserPlus, UserX, MessageSquare, Check, MapPin } from 'lucide-react';

export const ProfileSuggestions = ({ onSelectUser, onOpenChatWithUser }) => {
  const { currentUser, users } = useAuth();
  const { getFriendshipStatus, sendFriendRequest, rejectFriendRequest } = useSocial();
  const { showToast } = useToast();

  const handleSendRequest = async (targetUserId) => {
    const res = await sendFriendRequest(targetUserId);
    showToast(res.success ? 'Convite enviado!' : res.message, res.success ? 'success' : 'error');
  };

  const handleCancelRequest = async (targetUserId) => {
    const res = await rejectFriendRequest(targetUserId);
    showToast(res.success ? 'Convite cancelado.' : res.message, res.success ? 'success' : 'error');
  };

  // Narrowed by the user's saved preferences (gender, age range, distance
  // from their city) — same rule as the Explorar/Match tabs.
  const suggestions = users.filter(u => {
    if (u.id === currentUser?.id) return false;
    if (!currentUser) return true;

    const prefs = currentUser.preferences || {};
    if (prefs.genders?.length > 0) {
      const g = u.isCouple ? 'Casal' : u.gender;
      if (!prefs.genders.includes(g)) return false;
    }

    const age = u.isCouple
      ? Math.min(Number(u.partner1?.age) || 0, Number(u.partner2?.age) || 0)
      : Number(u.age) || 0;
    if (prefs.ageMin && age < Number(prefs.ageMin)) return false;
    if (prefs.ageMax && age > Number(prefs.ageMax)) return false;

    if (prefs.radiusKm && !isWithinRadius(currentUser.location, u.location, Number(prefs.radiusKm))) {
      return false;
    }

    return true;
  });

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
                  <button
                    onClick={() => handleCancelRequest(u.id)}
                    className="w-full py-1.5 bg-[var(--c-overlay-5)] hover:bg-red-500/10 border border-[var(--c-border)] hover:border-red-500/30 rounded-xl text-[10px] text-[var(--c-text-muted)] hover:text-red-400 font-medium text-center flex items-center justify-center gap-1 transition"
                  >
                    <UserX className="w-3 h-3" /> Cancelar convite
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendRequest(u.id)}
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
