import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { PostCard } from './PostCard';
import { Sparkles, TrendingUp, Lock, Flame } from 'lucide-react';

// Ranks posts by total interactions (likes + comments) rather than recency,
// so a post from yesterday with a lot of engagement still surfaces above a
// brand-new one with none.
const engagementScore = (post) => (post.likesCount || 0) + (post.comments?.length || 0);

export const TrendingFeed = ({ onOpenChatWithUser, onSelectUser }) => {
  const { currentUser, setIsProModalOpen, setIsAuthModalOpen } = useAuth();
  const { posts, postsLoading } = useSocial();

  const trendingPosts = useMemo(
    () =>
      [...posts]
        .filter(p => engagementScore(p) > 0)
        .sort((a, b) => engagementScore(b) - engagementScore(a) || (b.postedAt || 0) - (a.postedAt || 0)),
    [posts]
  );

  if (!currentUser) {
    return (
      <div className="p-8 bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl text-center space-y-4 max-w-md mx-auto my-12">
        <TrendingUp className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-[var(--c-text)]">Em Alta VIP</h3>
        <p className="text-xs text-[var(--c-accent)]">Faça login para ver as publicações com mais curtidas e comentários da rede.</p>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
        >
          Entrar na Conta
        </button>
      </div>
    );
  }

  // Trending is a VIP-only perk, same paywall pattern as the group rooms.
  if (!currentUser.isPro) {
    return (
      <div className="p-8 bg-gradient-to-b from-amber-950/40 via-rose-950/30 to-[var(--c-surface)] border border-amber-500/30 rounded-3xl text-center space-y-4 max-w-md mx-auto my-12 shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/20">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-[var(--c-text)]">Aba Em Alta Exclusiva VIP</h3>
        <p className="text-xs text-[var(--c-accent)]">
          As publicações com mais curtidas e comentários da rede são visíveis apenas para membros com <strong className="text-[var(--c-pro-text)]">Conta VIP</strong>. Assine para visualizar.
        </p>
        <button
          onClick={() => setIsProModalOpen(true)}
          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 fill-black" /> Desbloquear com Conta VIP
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/30 p-4 rounded-2xl">
        <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex-shrink-0">
          <Flame className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-1.5">
            Em Alta <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          </h2>
          <p className="text-[11px] text-[var(--c-text-muted)]">Publicações com mais curtidas e comentários da rede — exclusivo para membros VIP.</p>
        </div>
      </div>

      <div className="space-y-6">
        {postsLoading ? (
          <div className="flex items-center justify-center py-16 text-[var(--c-text-muted)]">
            <TrendingUp className="w-6 h-6 animate-pulse" />
          </div>
        ) : trendingPosts.length === 0 ? (
          <div className="text-center py-12 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl space-y-2">
            <Flame className="w-10 h-10 text-[var(--c-text-faint)] mx-auto" />
            <p className="text-sm font-semibold text-[var(--c-text-muted)]">Ainda não há publicações com curtidas ou comentários suficientes.</p>
          </div>
        ) : (
          trendingPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onOpenChatWithUser={onOpenChatWithUser}
              onSelectUser={onSelectUser}
            />
          ))
        )}
      </div>
    </div>
  );
};
