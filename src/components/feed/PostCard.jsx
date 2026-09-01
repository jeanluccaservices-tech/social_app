import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { Avatar } from '../common/Avatar';
import { MediaLightbox } from '../common/MediaLightbox';
import { REPORT_REASONS } from '../../lib/constants';
import { noDownloadImageProps } from '../../lib/mediaProtection';
import { useToast } from '../../context/ToastContext';
import { Heart, MessageCircle, Sparkles, UserPlus, MessageSquare, Send, Check, Trash2, MoreVertical, Flag, X, Users } from 'lucide-react';

export const PostCard = ({ post, onOpenChatWithUser, onSelectUser, autoOpenComments = false }) => {
  const { currentUser, users, setIsAuthModalOpen } = useAuth();
  const { toggleLikePost, addComment, deletePost, deleteComment, reportPost, getFriendshipStatus, sendFriendRequest } = useSocial();
  const { showToast } = useToast();
  const [showComments, setShowComments] = useState(false);

  // Coming from a "commented on your post" notification — land with the
  // comment thread already open instead of making the person click again.
  useEffect(() => {
    if (autoOpenComments) setShowComments(true);
  }, [autoOpenComments]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState(null);
  const [showLikers, setShowLikers] = useState(false);

  // Post options menu (⋮): delete (own posts) or report (others' posts)
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsView, setOptionsView] = useState('menu'); // 'menu' | 'confirm-delete' | 'report' | 'report-details' | 'reported'
  const [reportReason, setReportReason] = useState(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const optionsRef = useRef(null);

  useEffect(() => {
    if (!optionsOpen) return;
    const handleClickOutside = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setOptionsOpen(false);
        setOptionsView('menu');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [optionsOpen]);

  const handleSelectReportReason = (reason) => {
    setReportReason(reason);
    setReportDetails('');
    setOptionsView('report-details');
  };

  const handleSubmitReport = async () => {
    if (!reportReason) return;
    setReportSubmitting(true);
    const res = await reportPost(post.id, reportReason, reportDetails.trim());
    setReportSubmitting(false);
    if (res.success) {
      setOptionsView('reported');
    } else {
      showToast(res.message || 'Não foi possível enviar a denúncia.', 'error');
      setOptionsView('menu');
    }
  };

  const likers = (post.likes || []).map(id => users.find(u => u.id === id)).filter(Boolean);

  // Find author
  const author = users.find(u => u.id === post.userId) || {
    id: post.userId,
    name: 'Usuário',
    username: 'user',
    avatar: '',
    gender: 'Solteiro',
    isCouple: false,
    isPro: false
  };

  const isMyPost = currentUser?.id === author.id;
  const friendStatus = getFriendshipStatus(author.id);

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!commentInput.trim()) return;
    addComment(post.id, commentInput);
    setCommentInput('');
  };

  return (
    <div className="bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl shadow-xl overflow-hidden transition hover:border-rose-500/40">
      {/* Post Header */}
      <div className="p-4 flex items-center justify-between">
        <div
          onClick={() => onSelectUser(author)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative">
            <Avatar
              src={author.avatar}
              alt={author.name}
              isCouple={author.isCouple}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-rose-500/40 group-hover:ring-rose-500 transition"
            />
            {author.isCouple && (
              <span className="absolute -bottom-1 -right-1 bg-rose-600 text-white text-[9px] p-0.5 rounded-full border border-black">
                ❤️
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--c-text)] group-hover:text-rose-400 transition">
                {author.name}
              </h3>
              {author.isPro && (
                <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" title="Membro VIP" />
              )}
            </div>

            <p className="text-[11px] text-[var(--c-accent)]">
              @{author.username} • {author.isCouple ? `Casal (${author.age} anos)` : `${author.gender}, ${author.age} anos`} • {post.createdAt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Action Button for non-authors */}
          {!isMyPost && currentUser && (
            friendStatus === 'ACCEPTED' ? (
              <button
                onClick={() => onOpenChatWithUser(author)}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-[var(--c-accent)] border border-rose-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
            ) : friendStatus === 'SENT' ? (
              <span className="px-2.5 py-1 bg-[var(--c-overlay-5)] border border-[var(--c-border)] rounded-xl text-[10px] text-[var(--c-text-muted)] flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" /> Enviado
              </span>
            ) : (
              <button
                onClick={() => sendFriendRequest(author.id)}
                className="px-3 py-1.5 bg-[var(--c-overlay-5)] hover:bg-rose-500/20 border border-[var(--c-border)] hover:border-rose-500/40 text-[var(--c-text-secondary)] hover:text-[var(--c-text)] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <UserPlus className="w-3.5 h-3.5 text-rose-400" />
                <span>Conectar</span>
              </button>
            )
          )}

          {/* Options menu (⋮): delete for own posts, report for others' */}
          {currentUser && (
            <div className="relative" ref={optionsRef}>
              <button
                onClick={() => { setOptionsOpen(!optionsOpen); setOptionsView('menu'); }}
                title="Opções"
                className="p-2 text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-10)] rounded-xl transition"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {optionsOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-2xl overflow-hidden z-20">
                  {optionsView === 'menu' && (
                    isMyPost ? (
                      <button
                        onClick={() => setOptionsView('confirm-delete')}
                        className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
                      >
                        <Trash2 className="w-4 h-4" /> Excluir publicação
                      </button>
                    ) : (
                      <button
                        onClick={() => setOptionsView('report')}
                        className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-[var(--c-text-secondary)] hover:bg-[var(--c-overlay-5)] transition"
                      >
                        <Flag className="w-4 h-4 text-amber-400" /> Denunciar publicação
                      </button>
                    )
                  )}

                  {optionsView === 'confirm-delete' && (
                    <div className="p-3 space-y-2">
                      <p className="text-[11px] text-[var(--c-text-secondary)] px-1">Excluir esta publicação?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setOptionsOpen(false);
                            const res = await deletePost(post.id);
                            showToast(res.success ? 'Publicação apagada.' : res.message, res.success ? 'success' : 'error');
                          }}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold transition"
                        >
                          Excluir
                        </button>
                        <button
                          onClick={() => setOptionsView('menu')}
                          className="flex-1 py-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] text-[var(--c-text-muted)] rounded-lg text-[11px] font-bold transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {optionsView === 'report' && (
                    <div className="p-2 max-h-72 overflow-y-auto">
                      <p className="text-[10px] font-bold text-[var(--c-text-muted)] uppercase tracking-wider px-2 py-1.5">Motivo da denúncia</p>
                      {REPORT_REASONS.map(reason => (
                        <button
                          key={reason}
                          onClick={() => handleSelectReportReason(reason)}
                          className="w-full text-left px-3 py-2 text-xs text-[var(--c-text-secondary)] hover:bg-[var(--c-overlay-5)] rounded-lg transition"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}

                  {optionsView === 'report-details' && (
                    <div className="p-3 space-y-2">
                      <p className="text-[11px] text-[var(--c-text-secondary)] px-1">
                        Motivo: <span className="font-bold text-[var(--c-text)]">{reportReason}</span>
                      </p>
                      <textarea
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        placeholder="Detalhes adicionais (opcional)..."
                        rows={3}
                        className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg p-2 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500/50 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSubmitReport}
                          disabled={reportSubmitting}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-60"
                        >
                          {reportSubmitting ? 'Enviando...' : 'Enviar denúncia'}
                        </button>
                        <button
                          onClick={() => setOptionsView('report')}
                          disabled={reportSubmitting}
                          className="flex-1 py-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] text-[var(--c-text-muted)] rounded-lg text-[11px] font-bold transition"
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                  )}

                  {optionsView === 'reported' && (
                    <div className="p-4 text-center space-y-1">
                      <Flag className="w-5 h-5 text-emerald-400 mx-auto" />
                      <p className="text-xs text-[var(--c-text)] font-semibold">Denúncia enviada.</p>
                      <p className="text-[10px] text-[var(--c-text-muted)]">Nossa equipe vai analisar.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Text Content */}
      <div className="px-4 pb-3">
        <p className="text-xs text-[var(--c-text-dim)] leading-relaxed whitespace-pre-line">
          {post.content}
        </p>
      </div>

      {/* Post Media (Photo) */}
      {post.mediaUrl && (
        <div className="relative bg-black/40 overflow-hidden max-h-[450px] flex items-center justify-center">
          <img
            src={post.mediaUrl}
            alt="Mídia da postagem"
            onClick={() => setLightboxSrc(post.mediaUrl)}
            className="w-full max-h-[450px] object-cover hover:scale-102 transition duration-300 cursor-zoom-in"
            {...noDownloadImageProps}
          />
        </div>
      )}

      {/* Interaction Bar */}
      <div className="p-4 flex items-center justify-between border-t border-[var(--c-border-soft)] bg-[var(--c-surface-2)]/40">
        <div className="flex items-center gap-4">
          {/* Like Button */}
          <div className={`flex items-center gap-1.5 text-xs font-bold ${
            post.likedByMe ? 'text-rose-500' : 'text-[var(--c-text-muted)]'
          }`}>
            <button
              onClick={() => {
                if (!currentUser) setIsAuthModalOpen(true);
                else toggleLikePost(post.id);
              }}
              className="flex items-center transition transform active:scale-125 hover:text-rose-400"
            >
              <Heart className={`w-5 h-5 ${post.likedByMe ? 'fill-current text-rose-500' : ''}`} />
            </button>
            <button
              onClick={() => post.likesCount > 0 && setShowLikers(true)}
              disabled={post.likesCount === 0}
              className="hover:underline disabled:no-underline"
              title={post.likesCount > 0 ? 'Ver quem curtiu' : undefined}
            >
              {post.likesCount}
            </button>
          </div>

          {/* Comment Toggle Button */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--c-text-muted)] hover:text-[var(--c-text)] transition"
          >
            <MessageCircle className="w-5 h-5 text-purple-400" />
            <span>{post.comments.length}</span>
          </button>
        </div>

        {/* See Likers Button — pinned to the corner since burying it in the
            like counter above made it too easy to miss. */}
        {post.likesCount > 0 && (
          <button
            onClick={() => setShowLikers(true)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--c-text-muted)] hover:text-rose-400 transition px-2.5 py-1 rounded-full border border-[var(--c-border)] hover:border-rose-500/40"
            title="Ver quem curtiu"
          >
            <Users className="w-3.5 h-3.5" /> Ver curtidas
          </button>
        )}
      </div>

      {/* Comments Drawer */}
      {showComments && (
        <div className="bg-[var(--c-surface-3)] p-4 border-t border-[var(--c-border)] space-y-3 animate-in slide-in-from-top-2 duration-200">
          <p className="text-[11px] font-bold text-[var(--c-text-muted)] uppercase tracking-wider">
            Comentários ({post.comments.length})
          </p>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {post.comments.length === 0 ? (
              <p className="text-xs text-[var(--c-text-faint)] italic text-center py-2">Seja o primeiro a comentar!</p>
            ) : (
              post.comments.map(c => (
                <div key={c.id} className="flex items-start gap-2.5 bg-[var(--c-surface)] p-2.5 rounded-2xl border border-[var(--c-border-soft)]">
                  <Avatar src={c.userAvatar} alt={c.userName} className="w-7 h-7 rounded-full object-cover mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--c-text)]">{c.userName}</span>
                      <span className="text-[10px] text-[var(--c-text-faint)] flex-shrink-0">{c.createdAt}</span>
                    </div>
                    <p className="text-xs text-[var(--c-text-secondary)] mt-0.5">{c.text}</p>
                  </div>
                  {currentUser?.id === c.userId && (
                    confirmDeleteCommentId === c.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => { deleteComment(post.id, c.id); setConfirmDeleteCommentId(null); }}
                          className="px-1.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md text-[9px] font-bold transition"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setConfirmDeleteCommentId(null)}
                          className="px-1.5 py-1 bg-[var(--c-overlay-5)] text-[var(--c-text-muted)] rounded-md text-[9px] font-bold transition"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteCommentId(c.id)}
                        title="Excluir comentário"
                        className="p-1 text-[var(--c-text-faint)] hover:text-red-400 rounded-lg transition flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              ))
            )}
          </div>

          {/* Comment Input */}
          <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Escreva um comentário..."
              className="flex-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      <MediaLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {/* Curtidas Modal — who liked this post */}
      {showLikers && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowLikers(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm max-h-[70vh] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--c-border-soft)]">
              <h3 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-500 fill-current" /> Curtidas ({likers.length})
              </h3>
              <button
                onClick={() => setShowLikers(false)}
                className="p-1.5 text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-10)] rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {likers.length === 0 ? (
                <p className="text-xs text-[var(--c-text-faint)] text-center py-6">Ninguém curtiu ainda.</p>
              ) : (
                likers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setShowLikers(false); onSelectUser(u); }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--c-overlay-5)] rounded-2xl transition text-left"
                  >
                    <Avatar src={u.avatar} alt={u.name} isCouple={u.isCouple} className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-500/30" />
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-[var(--c-text)] truncate">{u.name}</p>
                      <p className="text-[10px] text-[var(--c-accent)] truncate">@{u.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
