import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { timeAgo, formatClockTime } from '../utils/time';
import { useAuth } from './AuthContext';

const SocialContext = createContext();

const mapPost = (p) => ({
  id: p.id,
  userId: p.user_id,
  type: p.type,
  content: p.content,
  mediaUrl: p.media_url,
  createdAtRaw: p.created_at,
  likes: (p.post_likes || []).map(l => l.user_id),
  comments: (p.comments || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(c => ({
      id: c.id,
      userId: c.user_id,
      userName: c.profiles?.name || 'Usuário',
      userAvatar: c.profiles?.avatar_url || '',
      text: c.text,
      createdAt: timeAgo(c.created_at)
    }))
});

export const SocialProvider = ({ children }) => {
  const { currentUser, users, fetchUsers: refetchUsers } = useAuth();

  const [rawPosts, setRawPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [friendships, setFriendships] = useState([]);
  const [messages, setMessages] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedProfiles, setBlockedProfiles] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);

  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  // --- FETCHING ---
  // Depends on currentUser so it re-runs when login finishes — posts RLS
  // requires auth.uid(), and SocialProvider mounts (and fires this once)
  // before that first login completes, so without this dependency the
  // very first fetch happens while still logged out and never retries.
  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    const { data } = await supabase
      .from('posts')
      .select(`
        id, user_id, type, content, media_url, created_at,
        post_likes ( user_id ),
        comments ( id, user_id, text, created_at, profiles ( name, avatar_url ) )
      `)
      .order('created_at', { ascending: false });
    setRawPosts((data || []).map(mapPost));
    setPostsLoading(false);
  }, [currentUser]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const fetchContacts = useCallback(async () => {
    if (!currentUser) {
      setFriendships([]);
      setMessages([]);
      setBlockedUsers([]);
      setContactsLoading(false);
      return;
    }

    const [{ data: friendshipRows }, { data: messageRows }, { data: blockedRows }] = await Promise.all([
      supabase.from('friendships').select('*'),
      supabase.from('messages').select('*').order('created_at', { ascending: true }),
      supabase.from('blocked_users').select('*')
    ]);

    setFriendships((friendshipRows || []).map(f => ({
      id: f.id,
      userId1: f.user_id_1,
      userId2: f.user_id_2,
      status: f.status,
      requesterId: f.requester_id
    })));

    setMessages((messageRows || []).map(m => ({
      id: m.id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      text: m.text || '',
      mediaUrl: m.media_url || '',
      readAt: m.read_at,
      timestamp: formatClockTime(m.created_at)
    })));

    setBlockedUsers((blockedRows || []).map(b => b.blocked_id));

    setContactsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    setContactsLoading(true);
    fetchContacts();
  }, [fetchContacts]);

  // Light polling instead of a full realtime subscription — same tradeoff
  // as notifications below: good enough to surface new messages without
  // websocket infrastructure.
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(fetchContacts, 10000);
    return () => clearInterval(interval);
  }, [currentUser, fetchContacts]);

  // --- NOTIFICATIONS ---
  // Likes/comments on my posts, and friend requests I've received or that
  // got accepted. Written server-side by DB triggers, never inserted
  // directly by the client.
  const fetchNotifications = useCallback(async () => {
    if (!currentUser) {
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }
    setNotificationsLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, type, read_at, created_at, post_id, actor:profiles!notifications_actor_id_fkey ( name, avatar_url, is_couple )')
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications((data || []).map(n => ({
      id: n.id,
      type: n.type,
      postId: n.post_id,
      readAt: n.read_at,
      createdAt: timeAgo(n.created_at),
      actorName: n.actor?.name || 'Alguém',
      actorAvatar: n.actor?.avatar_url || '',
      actorIsCouple: n.actor?.is_couple || false
    })));
    setNotificationsLoading(false);
  }, [currentUser]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Light polling instead of a full realtime subscription — good enough to
  // surface new notifications without websocket infrastructure. Matches
  // the message poll interval so a like/comment/friend request shows up
  // about as fast as a new message does.
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [currentUser, fetchNotifications]);

  const unreadNotificationCount = notifications.filter(n => !n.readAt).length;

  const markNotificationsRead = async (ids) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setNotifications(prev => prev.map(n => idSet.has(n.id) ? { ...n, readAt: n.readAt || new Date().toISOString() } : n));
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null);
  };

  const markAllNotificationsRead = () => {
    markNotificationsRead(notifications.filter(n => !n.readAt).map(n => n.id));
  };

  // --- DERIVED POSTS (likedByMe / likesCount depend on currentUser) ---
  const posts = useMemo(() => rawPosts.map(p => ({
    ...p,
    likesCount: p.likes.length,
    likedByMe: !!currentUser && p.likes.includes(currentUser.id),
    createdAt: timeAgo(p.createdAtRaw),
    postedAt: new Date(p.createdAtRaw).getTime()
  })), [rawPosts, currentUser]);

  // --- FRIENDSHIP HELPERS ---
  const areFriends = (userIdA, userIdB) => {
    if (!userIdA || !userIdB) return false;
    return friendships.some(f =>
      f.status === 'ACCEPTED' &&
      ((f.userId1 === userIdA && f.userId2 === userIdB) ||
       (f.userId1 === userIdB && f.userId2 === userIdA))
    );
  };

  const findFriendshipRow = (targetUserId) => {
    if (!currentUser) return null;
    return friendships.find(f =>
      (f.userId1 === currentUser.id && f.userId2 === targetUserId) ||
      (f.userId1 === targetUserId && f.userId2 === currentUser.id)
    ) || null;
  };

  const getFriendshipStatus = (targetUserId) => {
    if (!currentUser || currentUser.id === targetUserId) return 'SELF';
    const found = findFriendshipRow(targetUserId);
    if (!found) return 'NONE';
    if (found.status === 'ACCEPTED') return 'ACCEPTED';
    if (found.status === 'PENDING') {
      return found.requesterId === currentUser.id ? 'SENT' : 'RECEIVED';
    }
    return 'NONE';
  };

  const sendFriendRequest = async (targetUserId) => {
    if (!currentUser) return { success: false, message: 'Faça login para enviar convites.' };

    const status = getFriendshipStatus(targetUserId);
    if (status === 'SENT') return { success: false, message: 'Você já enviou um convite para essa pessoa.' };
    if (status === 'ACCEPTED') return { success: false, message: 'Vocês já são amigos.' };
    if (status === 'RECEIVED') return { success: false, message: 'Essa pessoa já te enviou um convite — veja na aba Convites.' };
    if (status !== 'NONE') return { success: false, message: 'Não foi possível enviar o convite.' };

    const { data, error } = await supabase
      .from('friendships')
      .insert({ user_id_1: currentUser.id, user_id_2: targetUserId, status: 'PENDING', requester_id: currentUser.id })
      .select()
      .single();
    if (error) return { success: false, message: 'Não foi possível enviar o convite. Tente novamente.' };

    setFriendships(prev => [...prev, {
      id: data.id, userId1: data.user_id_1, userId2: data.user_id_2, status: data.status, requesterId: data.requester_id
    }]);
    return { success: true };
  };

  const acceptFriendRequest = async (targetUserId) => {
    const row = findFriendshipRow(targetUserId);
    if (!row) return { success: false, message: 'Convite não encontrado.' };
    const { error } = await supabase.from('friendships').update({ status: 'ACCEPTED' }).eq('id', row.id);
    if (error) return { success: false, message: 'Não foi possível aceitar o convite. Tente novamente.' };
    setFriendships(prev => prev.map(f => f.id === row.id ? { ...f, status: 'ACCEPTED' } : f));
    return { success: true };
  };

  const rejectFriendRequest = async (targetUserId) => {
    const row = findFriendshipRow(targetUserId);
    if (!row) return { success: false, message: 'Convite não encontrado.' };
    const { error } = await supabase.from('friendships').delete().eq('id', row.id);
    if (error) return { success: false, message: 'Não foi possível concluir a ação. Tente novamente.' };
    setFriendships(prev => prev.filter(f => f.id !== row.id));
    return { success: true };
  };

  const removeFriend = (targetUserId) => rejectFriendRequest(targetUserId);

  // --- BLOCKING ---
  // Blocking hides the other person's profile, posts and comments from
  // each other everywhere in the app (enforced by RLS) and stops new
  // messages between them — both happen server-side, this just keeps the
  // local block list in sync so the UI (e.g. a "Bloquear" -> "Desbloquear"
  // toggle) can reflect it immediately.
  const isBlocked = (targetUserId) => blockedUsers.includes(targetUserId);

  const blockUser = async (targetUserId) => {
    if (!currentUser || !targetUserId || targetUserId === currentUser.id) return false;
    const { error } = await supabase.rpc('block_user', { target_user_id: targetUserId });
    if (error) return false;
    setBlockedUsers(prev => prev.includes(targetUserId) ? prev : [...prev, targetUserId]);
    setFriendships(prev => prev.filter(f =>
      !((f.userId1 === currentUser.id && f.userId2 === targetUserId) ||
        (f.userId1 === targetUserId && f.userId2 === currentUser.id))
    ));
    refetchUsers(); // blocked profile drops out of RLS's view immediately
    return true;
  };

  const unblockUser = async (targetUserId) => {
    if (!currentUser || !targetUserId) return false;
    const { error } = await supabase.rpc('unblock_user', { target_user_id: targetUserId });
    if (error) return false;
    setBlockedUsers(prev => prev.filter(id => id !== targetUserId));
    setBlockedProfiles(prev => prev.filter(p => p.id !== targetUserId));
    refetchUsers(); // the unblocked profile becomes visible again via RLS
    return true;
  };

  // Blocked profiles are hidden from the regular `users` list by RLS (0023),
  // so a "who have I blocked" screen needs its own read that bypasses that
  // — get_blocked_profiles() only ever returns the caller's own block list.
  const fetchBlockedProfiles = useCallback(async () => {
    if (!currentUser) {
      setBlockedProfiles([]);
      return;
    }
    const { data, error } = await supabase.rpc('get_blocked_profiles');
    if (error) return;
    setBlockedProfiles((data || []).map(p => ({
      id: p.id,
      name: p.name,
      username: p.username,
      avatar: p.avatar_url || '',
      isCouple: p.is_couple
    })));
  }, [currentUser]);

  // --- CHAT PERMISSION LOGIC ---
  // Only PRO members can start a new DM thread. A non-PRO member can still
  // reply once a PRO member has messaged them first (also enforced by RLS).
  const canChat = (targetUser) => {
    if (!currentUser || !targetUser) return { allowed: false, reason: 'NO_USER' };
    if (currentUser.id === targetUser.id) return { allowed: true, reason: 'SELF' };
    if (currentUser.isPro) return { allowed: true, reason: 'PRO' };
    const theyMessagedMeFirst = messages.some(
      m => m.senderId === targetUser.id && m.receiverId === currentUser.id
    );
    if (theyMessagedMeFirst) return { allowed: true, reason: 'REPLY' };
    return { allowed: false, reason: 'PRO_REQUIRED' };
  };

  const sendMessage = async (receiverId, text, mediaUrl) => {
    if (!currentUser || (!text?.trim() && !mediaUrl)) return false;
    const targetUser = users.find(u => u.id === receiverId);
    const permission = canChat(targetUser);
    if (!permission.allowed) return false;

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: currentUser.id, receiver_id: receiverId, text: text || '', media_url: mediaUrl || null })
      .select()
      .single();
    if (error) return false;

    setMessages(prev => [...prev, {
      id: data.id, senderId: data.sender_id, receiverId: data.receiver_id,
      text: data.text || '', mediaUrl: data.media_url || '', readAt: data.read_at,
      timestamp: formatClockTime(data.created_at)
    }]);
    return true;
  };

  const unreadMessageCount = currentUser
    ? messages.filter(m => m.receiverId === currentUser.id && !m.readAt).length
    : 0;

  // Marks every unread message from one sender as read — called when their
  // conversation is opened in the chat view.
  const markMessagesRead = async (senderId) => {
    if (!currentUser || !senderId) return;
    const idsToMark = messages
      .filter(m => m.senderId === senderId && m.receiverId === currentUser.id && !m.readAt)
      .map(m => m.id);
    if (idsToMark.length === 0) return;

    const nowIso = new Date().toISOString();
    const idSet = new Set(idsToMark);
    setMessages(prev => prev.map(m => idSet.has(m.id) ? { ...m, readAt: nowIso } : m));
    await supabase.from('messages').update({ read_at: nowIso }).in('id', idsToMark).is('read_at', null);
  };

  // --- POSTS HANDLERS ---
  const createPost = async ({ type, content, mediaUrl }) => {
    if (!currentUser) return { success: false, message: 'Faça login para publicar.' };
    const { data, error } = await supabase
      .from('posts')
      .insert({ user_id: currentUser.id, type: type || 'text', content, media_url: mediaUrl || null })
      .select()
      .single();
    if (error) return { success: false, message: 'Não foi possível publicar. Tente novamente.' };

    setRawPosts(prev => [{
      id: data.id, userId: data.user_id, type: data.type, content: data.content,
      mediaUrl: data.media_url, createdAtRaw: data.created_at, likes: [], comments: []
    }, ...prev]);
    return { success: true };
  };

  const toggleLikePost = async (postId) => {
    if (!currentUser) return;
    const post = rawPosts.find(p => p.id === postId);
    if (!post) return;
    const isLiked = post.likes.includes(currentUser.id);

    setRawPosts(prev => prev.map(p => p.id === postId
      ? { ...p, likes: isLiked ? p.likes.filter(id => id !== currentUser.id) : [...p.likes, currentUser.id] }
      : p));

    const { error } = isLiked
      ? await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentUser.id)
      : await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUser.id });

    if (error) {
      setRawPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likes: isLiked ? [...p.likes, currentUser.id] : p.likes.filter(id => id !== currentUser.id) }
        : p));
    }
  };

  const addComment = async (postId, text) => {
    if (!currentUser || !text.trim()) return;
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: currentUser.id, text })
      .select()
      .single();
    if (error) return;

    const newComment = {
      id: data.id, userId: currentUser.id, userName: currentUser.name,
      userAvatar: currentUser.avatar, text: data.text, createdAt: 'Agora'
    };
    setRawPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
  };

  // Soft delete: the row stays in the database (referenced by likes/etc.)
  // but is hidden from every read going forward. Goes through the
  // delete-post Edge Function (rather than a plain table UPDATE or RPC) so
  // the ownership check happens server-side AND, when the post has an
  // image, that file gets moved into a separate `deleted/` storage prefix
  // instead of staying mixed in with everyone's active media.
  const deletePost = async (postId) => {
    if (!currentUser) return { success: false, message: 'Faça login para continuar.' };
    const post = rawPosts.find(p => p.id === postId);
    if (!post || post.userId !== currentUser.id) return { success: false, message: 'Publicação não encontrada.' };

    setRawPosts(prev => prev.filter(p => p.id !== postId));
    const { error } = await supabase.functions.invoke('delete-post', { body: { post_id: postId } });
    if (error) {
      setRawPosts(prev => [post, ...prev]);
      return { success: false, message: 'Não foi possível apagar a publicação. Tente novamente.' };
    }
    return { success: true };
  };

  const deleteComment = async (postId, commentId) => {
    if (!currentUser) return;
    const post = rawPosts.find(p => p.id === postId);
    const comment = post?.comments.find(c => c.id === commentId);
    if (!comment || comment.userId !== currentUser.id) return;

    setRawPosts(prev => prev.map(p => p.id === postId
      ? { ...p, comments: p.comments.filter(c => c.id !== commentId) }
      : p));
    const { error } = await supabase.rpc('soft_delete_comment', { target_comment_id: commentId });
    if (error) {
      setRawPosts(prev => prev.map(p => p.id === postId
        ? { ...p, comments: [...p.comments, comment] }
        : p));
    }
  };

  // Goes through the report-post Edge Function (rather than a plain table
  // insert) so a moderation notification e-mail — reason, reporter,
  // reported post's content/link — always goes out alongside the report,
  // even though the row it writes is the same post_reports row either way.
  const reportPost = async (postId, reason, details) => {
    if (!currentUser) return { success: false, message: 'Faça login para denunciar.' };
    const { error } = await supabase.functions.invoke('report-post', {
      body: { post_id: postId, reason, details: details || null }
    });
    if (error) {
      const status = error?.context?.status;
      if (status === 409) return { success: false, message: 'Você já denunciou esta publicação.' };
      return { success: false, message: 'Não foi possível enviar a denúncia. Tente novamente.' };
    }
    return { success: true };
  };

  return (
    <SocialContext.Provider value={{
      posts,
      postsLoading,
      friendships,
      messages,
      contactsLoading,
      unreadMessageCount,
      markMessagesRead,
      notifications,
      notificationsLoading,
      unreadNotificationCount,
      markNotificationsRead,
      markAllNotificationsRead,
      areFriends,
      getFriendshipStatus,
      sendFriendRequest,
      acceptFriendRequest,
      rejectFriendRequest,
      removeFriend,
      blockedUsers,
      blockedProfiles,
      fetchBlockedProfiles,
      isBlocked,
      blockUser,
      unblockUser,
      canChat,
      sendMessage,
      createPost,
      toggleLikePost,
      addComment,
      deletePost,
      deleteComment,
      reportPost
    }}>
      {children}
    </SocialContext.Provider>
  );
};

export const useSocial = () => useContext(SocialContext);
