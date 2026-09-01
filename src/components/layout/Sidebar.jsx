import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { Avatar } from '../common/Avatar';
import { formatFullDateTime } from '../../utils/time';
import { Rss, MessageCircle, Users, User, Sparkles, Heart, Flame, TrendingUp, ShieldCheck } from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab, isOwnProfileActive, onOpenOwnProfile }) => {
  const { currentUser, setIsAuthModalOpen, setIsProModalOpen, isAdmin } = useAuth();
  const { friendships, unreadMessageCount } = useSocial();

  // Calculate pending friend requests count
  const pendingRequestsCount = currentUser
    ? friendships.filter(f => f.status === 'PENDING' && f.userId2 === currentUser.id).length
    : 0;

  const navItems = [
    { id: 'feed', label: 'Feed & Mídias', icon: Rss, badge: null },
    { id: 'trending', label: 'Em Alta', icon: TrendingUp, badge: 'VIP', badgeColor: 'bg-amber-500 text-black font-black' },
    { id: 'groups', label: 'Salas de Grupos', icon: Flame, badge: 'VIP', badgeColor: 'bg-amber-500 text-black font-black' },
    { id: 'chat', label: 'Chat Direto', icon: MessageCircle, badge: unreadMessageCount > 0 ? unreadMessageCount : null, badgeColor: 'bg-rose-600 text-white' },
    { id: 'friends', label: 'Amigos & Convites', icon: Users, badge: pendingRequestsCount > 0 ? pendingRequestsCount : null, badgeColor: 'bg-rose-600 text-white' },
    { id: 'profile', label: 'Meu Perfil', icon: User, badge: null },
    ...(isAdmin ? [{ id: 'admin', label: 'Painel Admin', icon: ShieldCheck, badge: null }] : [])
  ];

  return (
    <aside className="w-64 bg-[var(--c-surface-2)]/70 backdrop-blur-md border-r border-rose-500/20 p-4 flex flex-col justify-between hidden md:flex min-h-[calc(100vh-65px)] sticky top-[65px]">
      {/* Navigation List */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-[var(--c-text-muted)] uppercase tracking-wider px-3 mb-2">Menu Principal</p>

        {navItems.map(item => {
          const isActive = item.id === 'profile' ? isOwnProfileActive : activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => item.id === 'profile' ? onOpenOwnProfile() : setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-600/30'
                  : 'text-[var(--c-text-secondary)] hover:bg-[var(--c-overlay-5)] hover:text-[var(--c-text)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-rose-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* User Card & Account Status Box */}
      <div className="mt-8 space-y-3">
        {currentUser ? (
          <div className="p-3.5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl space-y-3">
            <div className="flex items-center gap-3">
              <Avatar
                src={currentUser.avatar}
                alt={currentUser.name}
                isCouple={currentUser.isCouple}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-500"
              />
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-[var(--c-text)] truncate flex items-center gap-1">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-[var(--c-accent)]">
                  {currentUser.isCouple ? '❤️ Casal' : currentUser.gender} • {currentUser.age} anos
                </p>
              </div>
            </div>

            {/* Account Status Info */}
            <div className="p-2 bg-[var(--c-bg)] rounded-xl border border-[var(--c-border-soft)] text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--c-text-muted)] font-medium">Plano Atual:</span>
                <span className={`font-bold flex items-center gap-1 ${currentUser.isPro ? 'text-amber-400' : 'text-[var(--c-text-secondary)]'}`}>
                  {currentUser.isPro ? (
                    <>
                      <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" /> VIP
                    </>
                  ) : (
                    'Gratuito'
                  )}
                </span>
              </div>

              {currentUser.isPro && (
                <div className="mt-1 text-[10px] text-[var(--c-text-muted)] space-y-0.5">
                  <div className="text-emerald-400">✔ Mensagens ilimitadas, Salas VIP & Em Alta</div>
                  {currentUser.proExpiresAt && (
                    <div>Válido até {formatFullDateTime(currentUser.proExpiresAt)}</div>
                  )}
                </div>
              )}
            </div>

            {!currentUser.isPro && (
              <button
                onClick={() => setIsProModalOpen(true)}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-extrabold text-xs rounded-xl shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 fill-black" /> Assinar VIP
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gradient-to-br from-rose-950/40 to-purple-950/40 border border-rose-500/30 rounded-2xl text-center space-y-2">
            <Heart className="w-8 h-8 text-rose-500 mx-auto fill-current animate-pulse" />
            <h4 className="text-xs font-bold text-[var(--c-text)]">Faça parte do LoveVibe</h4>
            <p className="text-[10px] text-[var(--c-accent)]">Conecte-se com pessoas e casais fascinantes!</p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              Entrar ou Cadastrar
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
