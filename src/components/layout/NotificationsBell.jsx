import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSocial } from '../../context/SocialContext';
import { Avatar } from '../common/Avatar';
import { Bell, Heart, MessageCircle, UserPlus, UserCheck, Loader2, X } from 'lucide-react';

const TYPE_META = {
  post_like: { icon: Heart, iconClass: 'text-rose-400', text: (n) => `${n.actorName} curtiu sua publicação` },
  post_comment: { icon: MessageCircle, iconClass: 'text-purple-400', text: (n) => `${n.actorName} comentou na sua publicação` },
  friend_request: { icon: UserPlus, iconClass: 'text-rose-400', text: (n) => `${n.actorName} enviou um pedido de amizade` },
  friend_accepted: { icon: UserCheck, iconClass: 'text-emerald-400', text: (n) => `${n.actorName} aceitou seu pedido de amizade` }
};

const FILTERS = [
  { id: 'all', label: 'Todas', types: null },
  { id: 'social', label: 'Curtidas & Comentários', types: ['post_like', 'post_comment'] },
  { id: 'friends', label: 'Amizades', types: ['friend_request', 'friend_accepted'] }
];

export const NotificationsBell = ({ onOpenProfile, onOpenFriends, onOpenPost }) => {
  const { notifications, notificationsLoading, unreadNotificationCount, markNotificationsRead, markAllNotificationsRead } = useSocial();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      const insideTrigger = triggerRef.current?.contains(e.target);
      const insidePanel = panelRef.current?.contains(e.target);
      if (!insideTrigger && !insidePanel) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const activeFilter = FILTERS.find(f => f.id === filter);
  const visibleNotifications = activeFilter.types
    ? notifications.filter(n => activeFilter.types.includes(n.type))
    : notifications;

  const handleNotificationClick = (n) => {
    markNotificationsRead([n.id]);
    setOpen(false);
    if (n.type === 'post_like' || n.type === 'post_comment') {
      if (n.postId) onOpenPost?.(n.postId, n.type);
      else onOpenProfile?.();
    } else {
      onOpenFriends?.();
    }
  };

  const panelBody = (
    <>
      <div className="p-3 border-b border-[var(--c-border-soft)] flex items-center justify-between flex-shrink-0">
        <span className="text-sm md:text-xs font-bold text-[var(--c-text)]">Notificações</span>
        <div className="flex items-center gap-3">
          {unreadNotificationCount > 0 && (
            <button
              onClick={markAllNotificationsRead}
              className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition"
            >
              Marcar todas como lidas
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="md:hidden p-1.5 -mr-1.5 text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-10)] rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-2 flex gap-1.5 border-b border-[var(--c-border-soft)] overflow-x-auto scrollbar-none flex-shrink-0">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg whitespace-nowrap transition ${
              filter === f.id
                ? 'bg-rose-600 text-white'
                : 'bg-[var(--c-surface-3)] text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 md:flex-none md:max-h-80 overflow-y-auto">
        {notificationsLoading ? (
          <div className="flex items-center justify-center py-8 text-[var(--c-text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : visibleNotifications.length === 0 ? (
          <p className="text-xs text-[var(--c-text-faint)] italic text-center py-8">Nenhuma notificação por aqui.</p>
        ) : (
          visibleNotifications.map(n => {
            const meta = TYPE_META[n.type];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full flex items-center gap-2.5 p-3 text-left border-b border-[var(--c-border-soft)] last:border-b-0 transition hover:bg-[var(--c-overlay-5)] ${
                  !n.readAt ? 'bg-rose-500/5' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar src={n.actorAvatar} alt={n.actorName} isCouple={n.actorIsCouple} className="w-8 h-8 rounded-full object-cover" />
                  <span className="absolute -bottom-1 -right-1 p-0.5 bg-[var(--c-surface)] rounded-full">
                    <Icon className={`w-3 h-3 ${meta.iconClass}`} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[var(--c-text-dim)] leading-snug">{meta.text(n)}</p>
                  <p className="text-[9px] text-[var(--c-text-faint)] mt-0.5">{n.createdAt}</p>
                </div>
                {!n.readAt && <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className="relative" ref={triggerRef}>
      <button
        onClick={() => setOpen(!open)}
        title="Notificações"
        className="relative p-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] border border-[var(--c-border)] rounded-xl text-[var(--c-accent)] transition"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {/* Desktop: a small dropdown anchored to the button, in normal flow. */}
      {open && (
        <div className="hidden md:flex absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[32rem] flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-2xl overflow-hidden z-50">
          {panelBody}
        </div>
      )}

      {/* Mobile: portaled straight to <body> as a full-screen sheet — this
          used to be a "fixed" div nested inside the sticky header, which
          traps it in the header's own stacking context (any ancestor with
          position + z-index creates one), so no z-index on the panel could
          ever make it paint above things outside that header. Portaling
          escapes that entirely instead of chasing z-index numbers. */}
      {open && createPortal(
        <div
          ref={panelRef}
          className="md:hidden fixed inset-0 z-[100] flex flex-col bg-[var(--c-surface)] shadow-2xl"
          style={{ height: '100dvh' }}
        >
          {panelBody}
        </div>,
        document.body
      )}
    </div>
  );
};
