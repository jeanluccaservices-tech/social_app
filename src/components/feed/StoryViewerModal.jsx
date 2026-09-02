import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { Avatar } from '../common/Avatar';
import { noDownloadImageProps } from '../../lib/mediaProtection';
import { useBackButtonClose } from '../../lib/useBackButtonClose';
import { X, Trash2, Eye, Loader2 } from 'lucide-react';

const STORY_DURATION_MS = 5000;

// Stays mounted at all times, gated by `isOpen`, instead of being
// mounted/unmounted by the parent — same reasoning as CreateStoryModal:
// StrictMode's dev-only mount→cleanup→mount dance on a freshly-mounted
// component using useBackButtonClose(true, ...) was popping the
// just-pushed history entry right after pushing it, closing the viewer
// the instant it opened.
//
// One author's stories in sequence — progress bar per story, tap the left
// third to go back, the right two-thirds to advance, auto-advances when a
// story's timer runs out. Closes itself once past the last one.
export const StoryViewerModal = ({ isOpen, stories, author, onClose }) => {
  const { currentUser } = useAuth();
  const { markStoryViewed, deleteStory, fetchStoryViewers } = useSocial();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const intervalRef = useRef(null);

  useBackButtonClose(isOpen, onClose);

  const story = stories[index];
  const isMine = currentUser?.id === author?.id;

  // Always start a freshly-opened viewer (or a switch to a different
  // author) from their first story.
  useEffect(() => {
    if (isOpen) setIndex(0);
  }, [isOpen, author?.id]);

  useEffect(() => {
    setShowViewers(false);
  }, [story?.id]);

  // Paused (no timer running) while the viewers list is open, so reading
  // it doesn't lose your place mid-story.
  useEffect(() => {
    if (!isOpen || showViewers) return;
    if (!story) {
      onClose();
      return;
    }
    markStoryViewed(story.id);
    setProgress(0);
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current);
        if (index < stories.length - 1) setIndex(index + 1);
        else onClose();
      }
    }, 50);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, story?.id, showViewers]);

  if (!isOpen || !story || !author) return null;

  const goNext = () => {
    if (index < stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  };
  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  const handleDelete = () => {
    if (!window.confirm('Excluir este story?')) return;
    deleteStory(story.id);
    goNext();
  };

  const handleShowViewers = async () => {
    setShowViewers(true);
    setViewersLoading(true);
    setViewers(await fetchStoryViewers(story.id));
    setViewersLoading(false);
  };

  // Portaled straight to <body>, same fix ChatView's mobile sheet and
  // CreateStoryModal use: rendered inline, this sits inside <main>'s
  // nested/scrollable ancestor chain, which clipped the overlay short of
  // the real screen bottom on mobile (leaving a strip of the app visible
  // underneath). A body-level portal plus 100dvh has no such ancestor.
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center" style={{ height: '100dvh' }}>
      <div className="relative w-full h-full max-w-md mx-auto">
        <div className="absolute top-2 left-2 right-2 z-10 flex gap-1">
          {stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: `${i < index ? 100 : i === index ? progress : 0}%` }}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-5 left-3 right-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar src={author.avatar} alt={author.name} className="w-8 h-8 rounded-full object-cover ring-2 ring-white/50" />
            <span className="text-white text-xs font-bold drop-shadow">{author.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {isMine && (
              <button onClick={handleDelete} className="p-2 text-white/80 hover:text-white transition">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-white/80 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <img
          src={story.mediaUrl}
          alt="Story"
          className="w-full h-full object-contain"
          {...noDownloadImageProps}
        />

        <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3" aria-label="Story anterior" />
        <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-2/3" aria-label="Próximo story" />

        {/* Sits on top of the (invisible) prev/next tap zones above in the
            DOM — later siblings paint above earlier ones here, so this is
            reachable — but it must actually be a clickable element, not
            just decorative text, or clicks fall through to "previous". */}
        {isMine && (
          <button
            onClick={handleShowViewers}
            className="absolute bottom-4 left-3 z-10 flex items-center gap-1.5 text-white/80 hover:text-white text-xs transition"
          >
            <Eye className="w-3.5 h-3.5" /> {story.viewerCount} {story.viewerCount === 1 ? 'visualização' : 'visualizações'}
          </button>
        )}

        {showViewers && (
          <div
            className="absolute inset-0 z-20 bg-black/70 flex flex-col justify-end"
            onClick={() => setShowViewers(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--c-surface)] rounded-t-3xl max-h-[60%] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--c-border-soft)] flex-shrink-0">
                <h4 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-rose-400" /> Visualizações
                </h4>
                <button
                  onClick={() => setShowViewers(false)}
                  className="p-1.5 text-[var(--c-text-muted)] hover:text-[var(--c-text)] rounded-full hover:bg-[var(--c-overlay-10)] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto p-2">
                {viewersLoading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--c-text-muted)]" />
                  </div>
                ) : viewers.length === 0 ? (
                  <p className="text-xs text-[var(--c-text-faint)] text-center py-6">Ninguém visualizou ainda.</p>
                ) : (
                  viewers.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 p-2.5">
                      <Avatar src={v.avatar} alt={v.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-[var(--c-text)] truncate">{v.name}</p>
                        <p className="text-[10px] text-[var(--c-text-muted)] truncate">@{v.username}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
