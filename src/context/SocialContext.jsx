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
  const { currentUser, users } = useAuth();

  const [rawPosts, setRawPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [friendships, setFriendships] = useState([]);
  const [messages, setMessages] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);

  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  // --- FETCHING ---
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
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    let active = true;

    const fetchContacts = async () => {
      if (!currentUser) {
        setFriendships([]);
        setMessages([]);
        setContactsLoading(false);
        return;
      }
      setContactsLoading(true);

      const [{ data: friendshipRows }, { data: messageRows }] = await Promise.all([
        supabase.from('friendships').select('*'),
        supabase.from('messages').select('*').order('created_at', { ascending: true })
      ]);

      if (!active) return;

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
        timestamp: formatClockTime(m.created_at)
      })));

      setContactsLoading(false);
    };

    fetchContacts();
    return () => { active = false; };
  }, [currentUser?.id]);

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
  // surface new notifications without websocket infrastructure.
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(fetchNotifications, 30000);
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
    if (!currentUser) return;
    if (getFriendshipStatus(targetUserId) !== 'NONE') return;

    const { data, error } = await supabase
      .from('friendships')
      .insert({ user_id_1: currentUser.id, user_id_2: targetUserId, status: 'PENDING', requester_id: currentUser.id })
      .select()
      .single();
    if (error) return;

    setFriendships(prev => [...prev, {
      id: data.id, userId1: data.user_id_1, userId2: data.user_id_2, status: data.status, requesterId: data.requester_id
    }]);
  };

  const acceptFriendRequest = async (targetUserId) => {
    const row = findFriendshipRow(targetUserId);
    if (!row) return;
    const { error } = await supabase.from('friendships').update({ status: 'ACCEPTED' }).eq('id', row.id);
    if (error) return;
    setFriendships(prev => prev.map(f => f.id === row.id ? { ...f, status: 'ACCEPTED' } : f));
  };

  const rejectFriendRequest = async (targetUserId) => {
    const row = findFriendshipRow(targetUserId);
    if (!row) return;
    const { error } = await supabase.from('friendships').delete().eq('id', row.id);
    if (error) return;
    setFriendships(prev => prev.filter(f => f.id !== row.id));
  };

  const removeFriend = (targetUserId) => rejectFriendRequest(targetUserId);

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
      text: data.text || '', mediaUrl: data.media_url || '', timestamp: formatClockTime(data.created_at)
    }]);
    return true;
  };

  // --- POSTS HANDLERS ---
  const createPost = async ({ type, content, mediaUrl }) => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('posts')
      .insert({ user_id: currentUser.id, type: type || 'text', content, media_url: mediaUrl || null })
      .select()
      .single();
    if (error) return;

    setRawPosts(prev => [{
      id: data.id, userId: data.user_id, type: data.type, content: data.content,
      mediaUrl: data.media_url, createdAtRaw: data.created_at, likes: [], comments: []
    }, ...prev]);
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
  // but is hidden from every read going forward. Goes through an RPC
  // (rather than a plain table UPDATE) so the ownership check happens
  // server-side in the function body.
  const deletePost = async (postId) => {
    if (!currentUser) return;
    const post = rawPosts.find(p => p.id === postId);
    if (!post || post.userId !== currentUser.id) return;

    setRawPosts(prev => prev.filter(p => p.id !== postId));
    const { error } = await supabase.rpc('soft_delete_post', { target_post_id: postId });
    if (error) setRawPosts(prev => [post, ...prev]);
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

  const reportPost = async (postId, reason, details) => {
    if (!currentUser) return { success: false, message: 'Faça login para denunciar.' };
    const { error } = await supabase
      .from('post_reports')
      .insert({ post_id: postId, reporter_id: currentUser.id, reason, details: details || null });
    if (error) {
      if (error.code === '23505') return { success: false, message: 'Você já denunciou esta publicação.' };
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
