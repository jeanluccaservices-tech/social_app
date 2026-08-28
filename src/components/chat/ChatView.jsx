import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { uploadImage } from '../../lib/storage';
import { ChatLockBanner } from './ChatLockBanner';
import { Avatar } from '../common/Avatar';
import { MediaLightbox } from '../common/MediaLightbox';
import { Send, Search, MessageSquare, ArrowLeft, Image as ImageIcon, X, Loader2 } from 'lucide-react';

export const ChatView = ({ selectedTargetUser, onSelectUser }) => {
  const { currentUser, users, setIsAuthModalOpen } = useAuth();
  const { messages, sendMessage, canChat, contactsLoading, areFriends, markMessagesRead } = useSocial();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeUser, setActiveUser] = useState(() => selectedTargetUser || null);
  // Mobile navigation: 'list' shows contacts, 'conversation' shows the open chat (WhatsApp-style).
  const [mobileView, setMobileView] = useState(selectedTargetUser ? 'conversation' : 'list');

  const [inputMessage, setInputMessage] = useState('');
  const [pendingImage, setPendingImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const imageInputRef = useRef(null);

  // Opening a conversation (including the one passed in via
  // selectedTargetUser on mount) clears its unread badge.
  useEffect(() => {
    if (activeUser) markMessagesRead(activeUser.id);
  }, [activeUser?.id, markMessagesRead]);

  if (!currentUser) {
    return (
      <div className="p-8 bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl text-center space-y-4 max-w-md mx-auto my-12">
        <MessageSquare className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-[var(--c-text)]">Acesse o Chat Direto</h3>
        <p className="text-xs text-[var(--c-accent)]">Faça login para visualizar e trocar mensagens com membros VIP.</p>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
        >
          Entrar na Conta
        </button>
      </div>
    );
  }

  // Who currentUser has already exchanged messages with — the contacts
  // list should only surface friends or people you've already talked to,
  // not every user on the app.
  const contactedUserIds = new Set(
    messages
      .filter(m => m.senderId === currentUser.id || m.receiverId === currentUser.id)
      .map(m => (m.senderId === currentUser.id ? m.receiverId : m.senderId))
  );

  // Filter contacts list
  const otherUsers = users.filter(u => u.id !== currentUser.id && (
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  ) && (areFriends(currentUser.id, u.id) || contactedUserIds.has(u.id)));

  const handleOpenConversation = (u) => {
    setActiveUser(u);
    setMobileView('conversation');
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  // Check chat permission for active user
  const chatPermission = activeUser ? canChat(activeUser) : { allowed: false };

  // Filter messages between currentUser and activeUser
  const conversationMessages = activeUser ? messages.filter(
    m => (m.senderId === currentUser.id && m.receiverId === activeUser.id) ||
         (m.senderId === activeUser.id && m.receiverId === currentUser.id)
  ) : [];

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !pendingImage) || !activeUser || sending) return;
    setSending(true);
    const ok = await sendMessage(activeUser.id, inputMessage, pendingImage);
    setSending(false);
    if (ok) {
      setInputMessage('');
      setPendingImage('');
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploadingImage(true);
    try {
      const url = await uploadImage('media', currentUser.id, file);
      setPendingImage(url);
    } catch {
      // upload failed silently; user can retry
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const getLastMessage = (u) => {
    const convo = messages.filter(
      m => (m.senderId === currentUser.id && m.receiverId === u.id) ||
           (m.senderId === u.id && m.receiverId === currentUser.id)
    );
    return convo.length > 0 ? convo[convo.length - 1] : null;
  };

  return (
    <div className="bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl overflow-hidden shadow-2xl h-[calc(100vh-120px)] max-w-5xl mx-auto flex flex-col md:flex-row">

      {/* Left Contacts Sidebar (list view on mobile, always visible on desktop) */}
      <div className={`w-full md:w-80 bg-[var(--c-surface-2)] border-b md:border-b-0 md:border-r border-[var(--c-border)] flex-col ${
        mobileView === 'list' ? 'flex' : 'hidden md:flex'
      }`}>
        {/* Search */}
        <div className="p-3 border-b border-[var(--c-border)]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--c-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar contatos no chat..."
              className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl py-2 pl-9 pr-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Contacts list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {contactsLoading ? (
            <div className="flex items-center justify-center py-10 text-[var(--c-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : otherUsers.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-1.5">
              <MessageSquare className="w-8 h-8 text-[var(--c-text-faint)] mx-auto" />
              <p className="text-xs font-semibold text-[var(--c-text-muted)]">Nenhuma conversa por aqui ainda.</p>
              <p className="text-[11px] text-[var(--c-text-faint)]">Adicione amigos ou envie uma mensagem a partir do perfil de alguém para começar.</p>
            </div>
          ) : otherUsers.map(u => {
            const isSelected = activeUser?.id === u.id;
            const lastMsg = getLastMessage(u);
            const hasUnread = messages.some(m => m.senderId === u.id && m.receiverId === currentUser.id && !m.readAt);

            return (
              <button
                key={u.id}
                onClick={() => handleOpenConversation(u)}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition text-left ${
                  isSelected
                    ? 'bg-gradient-to-r from-rose-600/30 to-pink-600/30 border border-rose-500/50'
                    : 'hover:bg-[var(--c-overlay-5)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="relative flex-shrink-0">
                    <Avatar src={u.avatar} alt={u.name} isCouple={u.isCouple} className="w-11 h-11 rounded-full object-cover border-2 border-rose-500/30" />
                    {u.isCouple && (
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-rose-600 text-white p-0.5 rounded-full">
                        ❤️
                      </span>
                    )}
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-[var(--c-surface-2)]" />
                    )}
                  </div>

                  <div className="overflow-hidden">
                    <p className={`text-xs truncate flex items-center gap-1 ${hasUnread ? 'font-extrabold text-[var(--c-text)]' : 'font-bold text-[var(--c-text)]'}`}>
                      {u.name}
                    </p>
                    <p className={`text-[10px] truncate ${hasUnread ? 'text-[var(--c-text)] font-semibold' : 'text-[var(--c-accent)]'}`}>
                      {lastMsg
                        ? (lastMsg.text || (lastMsg.mediaUrl ? '📷 Foto' : ''))
                        : `${u.isCouple ? 'Casal' : u.gender} • @${u.username}`}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Active Conversation Area (conversation view on mobile, always visible on desktop) */}
      <div className={`flex-1 flex-col justify-between bg-[var(--c-bg)] ${
        mobileView === 'conversation' ? 'flex' : 'hidden md:flex'
      }`}>
        {activeUser ? (
          <>
            {/* Header */}
            <div className="p-3 sm:p-4 bg-[var(--c-surface-2)] border-b border-[var(--c-border)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {/* Back button — only relevant on mobile conversation view */}
                <button
                  onClick={handleBackToList}
                  className="md:hidden p-2 -ml-1 text-[var(--c-text-secondary)] hover:text-[var(--c-text)] hover:bg-[var(--c-overlay-5)] rounded-xl transition flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div
                  onClick={() => onSelectUser(activeUser)}
                  className="flex items-center gap-3 cursor-pointer group min-w-0"
                >
                  <Avatar src={activeUser.avatar} alt={activeUser.name} isCouple={activeUser.isCouple} className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--c-text)] group-hover:text-rose-400 transition flex items-center gap-1.5 truncate">
                      {activeUser.name}
                      {activeUser.isCouple && <span className="text-xs text-rose-400">❤️</span>}
                    </h3>
                    <p className="text-[10px] text-[var(--c-accent)] truncate">
                      @{activeUser.username} • {activeUser.isCouple ? `Casal (${activeUser.age} anos)` : `${activeUser.gender}, ${activeUser.age} anos`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Body (Messages) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationMessages.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <MessageSquare className="w-10 h-10 text-[var(--c-text-faint)] mx-auto" />
                  <p className="text-xs text-[var(--c-text-muted)] font-semibold">Nenhuma mensagem trocada ainda.</p>
                  {chatPermission.allowed && (
                    <p className="text-[11px] text-[var(--c-accent)]">Envie um oi para começar a conversa!</p>
                  )}
                </div>
              ) : (
                conversationMessages.map(msg => {
                  const isMe = msg.senderId === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[75%] p-3 rounded-2xl text-xs space-y-2 ${
                          isMe
                            ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-br-none shadow-md shadow-rose-600/20'
                            : 'bg-[var(--c-surface)] text-[var(--c-text-dim)] border border-[var(--c-border)] rounded-bl-none'
                        }`}
                      >
                        {msg.mediaUrl && (
                          <img
                            src={msg.mediaUrl}
                            alt="Foto enviada"
                            onClick={() => setLightboxSrc(msg.mediaUrl)}
                            className="max-w-full max-h-64 rounded-xl object-cover cursor-zoom-in"
                          />
                        )}
                        {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                      </div>
                      <span className="text-[9px] text-[var(--c-text-faint)] mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input Field — visible to everyone, but sending requires PRO */}
            {chatPermission.allowed ? (
              <div className="bg-[var(--c-surface-2)] border-t border-[var(--c-border)]">
                {pendingImage && (
                  <div className="px-3 pt-3 flex items-center gap-2">
                    <div className="relative">
                      <img src={pendingImage} alt="Pré-visualização" className="w-16 h-16 rounded-xl object-cover border border-[var(--c-border)]" />
                      <button
                        type="button"
                        onClick={() => setPendingImage('')}
                        className="absolute -top-1.5 -right-1.5 bg-black/70 hover:bg-black text-white rounded-full p-0.5 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
                <form onSubmit={handleSend} className="p-3 flex gap-2">
                  {/* Sending photos is a PRO-only perk, even for non-PRO
                      members who are allowed to reply to a PRO sender. */}
                  {currentUser.isPro && (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="px-3 py-2.5 bg-[var(--c-surface)] hover:bg-[var(--c-overlay-10)] border border-[var(--c-border)] rounded-xl text-[var(--c-accent)] transition flex items-center justify-center flex-shrink-0 disabled:opacity-60"
                      title="Enviar foto (recurso VIP)"
                    >
                      {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    </button>
                  )}
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Escreva sua mensagem..."
                    className="flex-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl px-4 py-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center flex-shrink-0 disabled:opacity-60"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            ) : (
              <ChatLockBanner />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--c-text-faint)] text-xs">
            Selecione um contato para conversar.
          </div>
        )}
      </div>

      <MediaLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
};
