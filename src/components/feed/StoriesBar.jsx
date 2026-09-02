import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { Avatar } from '../common/Avatar';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewerModal } from './StoryViewerModal';
import { Plus } from 'lucide-react';

export const StoriesBar = () => {
  const { currentUser, users } = useAuth();
  const { stories } = useSocial();
  const [creating, setCreating] = useState(false);
  const [viewingUserId, setViewingUserId] = useState(null);

  const byUser = useMemo(() => {
    const map = new Map();
    stories.forEach((s) => {
      if (!map.has(s.userId)) map.set(s.userId, []);
      map.get(s.userId).push(s);
    });
    return map;
  }, [stories]);

  if (!currentUser) return null;

  const myStories = byUser.get(currentUser.id) || [];

  // Other authors with at least one story visible to me (RLS already
  // narrowed `stories` down to that), unseen ones first.
  const otherUserIds = [...byUser.keys()]
    .filter((id) => id !== currentUser.id)
    .sort((a, b) => {
      const aUnseen = byUser.get(a).some((s) => !s.viewedByMe);
      const bUnseen = byUser.get(b).some((s) => !s.viewedByMe);
      return aUnseen === bUnseen ? 0 : aUnseen ? -1 : 1;
    });

  const viewingStories = viewingUserId ? byUser.get(viewingUserId) || [] : [];
  const viewingAuthor = viewingUserId === currentUser?.id ? currentUser : users.find((u) => u.id === viewingUserId);

  return (
    <>
      <p className="text-xs text-[var(--c-text-muted)] px-0.5">
        Stories: fotos e vídeos rápidos que ficam visíveis por 24 horas. Toque em "Você" para postar o seu.
      </p>
      <div className="flex gap-3 overflow-x-auto p-1 scrollbar-none">
        {/* Your own bubble: tap the avatar to view your active stories (if
            any), tap the "+" to add a new one. */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
          <div className="relative w-14 h-14">
            <button
              onClick={() => (myStories.length > 0 ? setViewingUserId(currentUser.id) : setCreating(true))}
              className="w-14 h-14 rounded-full block"
            >
              <Avatar
                src={currentUser.avatar}
                alt={currentUser.name}
                className={`w-14 h-14 rounded-full object-cover ${
                  myStories.length > 0 ? 'ring-2 ring-rose-500' : 'ring-2 ring-[var(--c-border)]'
                }`}
              />
            </button>
            <button
              onClick={() => setCreating(true)}
              title="Adicionar story"
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-rose-600 hover:bg-rose-500 rounded-full flex items-center justify-center border-2 border-[var(--c-bg)] transition"
            >
              <Plus className="w-3 h-3 text-white" />
            </button>
          </div>
          <span className="text-[10px] text-[var(--c-text-muted)] truncate w-full text-center">Você</span>
        </div>

        {otherUserIds.map((userId) => {
          const user = users.find((u) => u.id === userId);
          if (!user) return null;
          const allViewed = byUser.get(userId).every((s) => s.viewedByMe);
          return (
            <button
              key={userId}
              onClick={() => setViewingUserId(userId)}
              className="flex flex-col items-center gap-1 flex-shrink-0 w-16"
            >
              <Avatar
                src={user.avatar}
                alt={user.name}
                isCouple={user.isCouple}
                className={`w-14 h-14 rounded-full object-cover ${
                  allViewed ? 'ring-2 ring-[var(--c-border)]' : 'ring-2 ring-rose-500'
                }`}
              />
              <span className="text-[10px] text-[var(--c-text-muted)] truncate w-full text-center">{user.name}</span>
            </button>
          );
        })}
      </div>

      {/* Both modals stay mounted always (isOpen just toggles their own
          internal render) rather than being mounted/unmounted here — see
          the comment atop each component for why that matters. */}
      <CreateStoryModal isOpen={creating} onClose={() => setCreating(false)} />
      <StoryViewerModal
        isOpen={!!viewingUserId}
        stories={viewingStories}
        author={viewingAuthor}
        onClose={() => setViewingUserId(null)}
      />
    </>
  );
};
