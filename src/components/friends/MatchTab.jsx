import React, { useRef, useState } from 'react';
import { Heart, X, MapPin, Sparkles, Undo2 } from 'lucide-react';
import { Avatar } from '../common/Avatar';

const SWIPE_THRESHOLD = 110;

export const MatchTab = ({ candidates, onLike, onSelectUser }) => {
  const [swipedIds, setSwipedIds] = useState(() => new Set());
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [lastAction, setLastAction] = useState(null); // { id, liked } — for the "undo" affordance
  const startXRef = useRef(0);
  // Guards against the stray click that fires on the newly-swapped-in top
  // card right after a drag-release (the browser still dispatches a click
  // after pointerup, and by then React has already swapped the card).
  const justSwipedRef = useRef(false);

  const deck = candidates.filter(u => !swipedIds.has(u.id));
  const topUser = deck[0];
  const nextUser = deck[1];

  const commitSwipe = (direction) => {
    if (!topUser) return;
    if (direction === 'right') onLike(topUser.id);
    setSwipedIds(prev => new Set(prev).add(topUser.id));
    setLastAction({ id: topUser.id, liked: direction === 'right' });
    setDragX(0);
    setDragging(false);
    justSwipedRef.current = true;
  };

  const handlePointerDown = (e) => {
    if (!topUser) return;
    justSwipedRef.current = false;
    setDragging(true);
    startXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    setDragX(e.clientX - startXRef.current);
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    if (dragX > SWIPE_THRESHOLD) commitSwipe('right');
    else if (dragX < -SWIPE_THRESHOLD) commitSwipe('left');
    else {
      setDragging(false);
      setDragX(0);
    }
  };

  const handleUndo = () => {
    if (!lastAction) return;
    setSwipedIds(prev => {
      const next = new Set(prev);
      next.delete(lastAction.id);
      return next;
    });
    setLastAction(null);
  };

  if (!topUser) {
    return (
      <div className="text-center py-16 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl space-y-2 max-w-md mx-auto">
        <Heart className="w-10 h-10 text-[var(--c-text-faint)] mx-auto" />
        <p className="text-sm font-semibold text-[var(--c-text-muted)]">Sem mais perfis por aqui.</p>
        <p className="text-[11px] text-[var(--c-accent)]">Volte mais tarde para descobrir novas pessoas!</p>
        {lastAction && (
          <button
            onClick={handleUndo}
            className="mt-2 px-4 py-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] text-xs font-bold text-[var(--c-text-secondary)] rounded-xl border border-[var(--c-border)] transition inline-flex items-center gap-1.5"
          >
            <Undo2 className="w-3.5 h-3.5" /> Desfazer última ação
          </button>
        )}
      </div>
    );
  }

  const rotation = Math.max(-15, Math.min(15, dragX / 10));
  const likeOpacity = Math.min(1, Math.max(0, dragX / SWIPE_THRESHOLD));
  const passOpacity = Math.min(1, Math.max(0, -dragX / SWIPE_THRESHOLD));

  const renderCardContent = (u) => (
    <>
      <div className="relative h-80 sm:h-96">
        <Avatar src={u.avatar} alt={u.name} isCouple={u.isCouple} className="w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent"></div>
        {u.isPro && (
          <div className="absolute top-3 right-3 bg-black/50 rounded-full p-1.5">
            <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
        )}
        {/* This content always sits over a photo + dark gradient, in both
            themes, so its colors are fixed light tones rather than the
            theme variables (which would go dark-on-dark in light mode). */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1.5">
          <h3 className="text-lg font-extrabold text-white flex items-center gap-1.5">
            {u.name} {u.isCouple && <span className="text-rose-400">❤️</span>}
            <span className="text-sm font-semibold text-gray-200">
              {u.isCouple ? '' : `• ${u.age} anos`}
            </span>
          </h3>
          <p className="text-xs text-gray-200 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-rose-400" /> {u.location || 'Brasil'}
          </p>
          {u.bio && (
            <p className="text-xs text-gray-100 line-clamp-2 leading-relaxed">{u.bio}</p>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="relative h-80 sm:h-96 select-none">
        {/* Next card peeking behind, for stack depth */}
        {nextUser && (
          <div className="absolute inset-0 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl overflow-hidden shadow-xl scale-[0.96] opacity-70 translate-y-2">
            {renderCardContent(nextUser)}
          </div>
        )}

        {/* Top draggable card */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => { if (!justSwipedRef.current && Math.abs(dragX) < 5) onSelectUser?.(topUser); }}
          style={{
            transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
            transition: dragging ? 'none' : 'transform 0.3s ease'
          }}
          className="absolute inset-0 bg-[var(--c-surface)] border border-rose-500/30 rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing touch-none"
        >
          {renderCardContent(topUser)}

          {/* Swipe direction hints */}
          <div
            style={{ opacity: likeOpacity }}
            className="absolute top-6 left-6 border-4 border-emerald-400 text-emerald-400 font-black text-lg px-3 py-1 rounded-xl -rotate-12"
          >
            CONVIDAR
          </div>
          <div
            style={{ opacity: passOpacity }}
            className="absolute top-6 right-6 border-4 border-red-400 text-red-400 font-black text-lg px-3 py-1 rounded-xl rotate-12"
          >
            PASSAR
          </div>
        </div>
      </div>

      {/* Action buttons (accessible alternative to dragging) */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => commitSwipe('left')}
          className="w-14 h-14 rounded-full bg-[var(--c-surface)] border border-[var(--c-border)] hover:border-red-500/50 text-red-400 flex items-center justify-center shadow-lg transition active:scale-95"
        >
          <X className="w-6 h-6" />
        </button>
        {lastAction && (
          <button
            onClick={handleUndo}
            title="Desfazer"
            className="w-10 h-10 rounded-full bg-[var(--c-surface)] border border-[var(--c-border)] hover:border-[var(--c-border-strong)] text-[var(--c-text-muted)] flex items-center justify-center shadow-lg transition active:scale-95"
          >
            <Undo2 className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => commitSwipe('right')}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition active:scale-95"
        >
          <Heart className="w-6 h-6 fill-current" />
        </button>
      </div>

      <p className="text-center text-[11px] text-[var(--c-text-faint)]">
        Arraste o card para a direita para convidar, ou para a esquerda para passar.
      </p>
    </div>
  );
};
