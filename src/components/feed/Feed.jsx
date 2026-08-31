import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { useToast } from '../../context/ToastContext';
import { CreatePost } from './CreatePost';
import { PostCard } from './PostCard';
import { isWithinRadius } from '../../lib/geo';
import { Users, Sparkles, Rss, Heart, Loader2 } from 'lucide-react';

// Whether an author matches the current user's stated preferences (age / gender / location radius).
const matchesPreferences = (currentUser, author) => {
  if (!currentUser?.preferences || !author) return false;
  const prefs = currentUser.preferences;

  const authorAge = author.isCouple
    ? Math.min(Number(author.partner1?.age) || 0, Number(author.partner2?.age) || 0)
    : Number(author.age) || 0;
  const ageOk = !authorAge || (authorAge >= (prefs.ageMin || 0) && authorAge <= (prefs.ageMax || 999));

  const authorGender = author.isCouple ? 'Casal' : author.gender;
  const genderOk = !prefs.genders || prefs.genders.length === 0 || prefs.genders.includes(authorGender);

  const locationOk = isWithinRadius(currentUser.location, author.location, prefs.radiusKm);

  return ageOk && genderOk && locationOk;
};

export const Feed = ({ onOpenChatWithUser, onSelectUser, highlightPostId, highlightType, onHighlightConsumed }) => {
  const { currentUser, users } = useAuth();
  const { posts, postsLoading, areFriends } = useSocial();
  const { showToast } = useToast();
  const [source, setSource] = useState('all'); // 'friends' | 'recommended' | 'all'
  const [pulsePostId, setPulsePostId] = useState(null);
  const [pulseType, setPulseType] = useState(null);
  const postRefs = useRef({});

  const authorsById = useMemo(() => {
    const map = new Map();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0)),
    [posts]
  );

  const visiblePosts = useMemo(() => {
    if (source === 'friends') {
      if (!currentUser) return [];
      return sortedPosts.filter(p => areFriends(currentUser.id, p.userId));
    }

    if (source === 'recommended') {
      if (!currentUser) return sortedPosts;
      return sortedPosts.filter(p => {
        if (p.userId === currentUser.id) return false;
        const author = authorsById.get(p.userId);
        if (!author) return false;
        return matchesPreferences(currentUser, author);
      });
    }

    return sortedPosts;
  }, [source, sortedPosts, currentUser, authorsById, areFriends]);

  // Landing here from a "liked/commented on your post" notification: jump
  // to "Todos" (the post may not match the current friends/recommended
  // filter) and remember which post to scroll to once it's in the list.
  useEffect(() => {
    if (!highlightPostId) return;
    if (!postsLoading && !posts.some(p => p.id === highlightPostId)) {
      showToast('Não foi possível abrir a publicação — ela pode ter sido removida.', 'error');
      onHighlightConsumed?.();
      return;
    }
    setSource('all');
    setPulsePostId(highlightPostId);
    setPulseType(highlightType);
    onHighlightConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightPostId, postsLoading]);

  useEffect(() => {
    if (!pulsePostId) return;
    const node = postRefs.current[pulsePostId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => { setPulsePostId(null); setPulseType(null); }, 2200);
    return () => clearTimeout(timer);
  }, [pulsePostId, visiblePosts]);

  const tabs = [
    { id: 'friends', label: 'Amigos', icon: Users },
    { id: 'recommended', label: 'Recomendados', icon: Sparkles },
    { id: 'all', label: 'Todos', icon: Rss }
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Post Creator Box */}
      <CreatePost />

      {/* Source Tabs */}
      <div className="flex items-center justify-between bg-[var(--c-surface-2)]/70 p-1.5 rounded-2xl border border-[var(--c-border)]">
        <span className="text-xs font-bold text-[var(--c-text-muted)] px-3 hidden sm:inline">Feed:</span>
        <div className="flex gap-1 w-full sm:w-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = source === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSource(t.id)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-5)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Post List */}
      <div className="space-y-6">
        {postsLoading ? (
          <div className="flex items-center justify-center py-16 text-[var(--c-text-muted)]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="text-center py-12 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl space-y-2">
            <Heart className="w-10 h-10 text-[var(--c-text-faint)] mx-auto" />
            <p className="text-sm font-semibold text-[var(--c-text-muted)]">
              {source === 'friends'
                ? 'Nenhuma publicação de amigos ainda. Adicione amigos para ver o feed deles aqui!'
                : source === 'recommended'
                ? 'Ainda sem recomendações. Complete seus interesses no perfil para receber sugestões.'
                : 'Nenhuma postagem encontrada.'}
            </p>
          </div>
        ) : (
          visiblePosts.map(post => (
            <div
              key={post.id}
              ref={(el) => { postRefs.current[post.id] = el; }}
              className={post.id === pulsePostId ? 'rounded-3xl ring-2 ring-rose-500 ring-offset-2 ring-offset-[var(--c-bg)] transition' : ''}
            >
              <PostCard
                post={post}
                onOpenChatWithUser={onOpenChatWithUser}
                onSelectUser={onSelectUser}
                autoOpenComments={post.id === pulsePostId && pulseType === 'post_comment'}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
