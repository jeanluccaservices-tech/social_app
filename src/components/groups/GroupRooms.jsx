import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { formatClockTime } from '../../utils/time';
import {
  Sparkles, Lock, Send, Users, Flame, ArrowLeft, Loader2, Compass, ShieldAlert, LogOut,
  HeartHandshake, Transgender, Users2, MessageCircle, Eye, Images, Drama, UsersRound, Star
} from 'lucide-react';

const ICONS = {
  HeartHandshake, Transgender, Users2, MessageCircle, Eye, Images, Drama, UsersRound, Compass, Star
};

// Matches the trans_only check in the group_room_members insert policy —
// couples are excluded since they don't have a single gender identity.
const TRANS_GENDERS = ['Mulher Trans', 'Homem Trans', 'Travesti', 'Crossdressing (CD)'];

// Whether the current profile meets a room's entry rule.
const isEligible = (currentUser, room) => {
  if (!currentUser) return false;
  switch (room.ruleType) {
    case 'couples_only':
      return currentUser.isCouple;
    case 'singles_only':
      return !currentUser.isCouple;
    case 'trans_only':
      return !currentUser.isCouple && TRANS_GENDERS.includes(currentUser.gender);
    case 'location':
      return (currentUser.location || '').toLowerCase().includes((room.ruleValue || '').toLowerCase());
    default:
      return true;
  }
};

const ruleDescription = (room) => {
  switch (room.ruleType) {
    case 'couples_only':
      return 'Somente casais podem participar desta sala.';
    case 'singles_only':
      return 'Somente perfis solteiros podem participar desta sala.';
    case 'trans_only':
      return 'Somente perfis trans ou travestis podem participar desta sala.';
    case 'location':
      return `Somente membros de ${room.ruleValue} podem participar desta sala.`;
    default:
      return null;
  }
};

export const GroupRooms = () => {
  const { currentUser, setIsProModalOpen, setIsAuthModalOpen } = useAuth();
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [joinError, setJoinError] = useState('');

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    const [{ data: rooms }, { data: msgs }, { data: members }] = await Promise.all([
      supabase.from('group_rooms').select('*').order('name'),
      supabase
        .from('group_room_messages')
        .select('id, room_id, sender_id, text, created_at, profiles ( name, is_couple, pro_expires_at )')
        .order('created_at', { ascending: true }),
      supabase.from('group_room_members').select('room_id, user_id')
    ]);

    const byRoom = {};
    (msgs || []).forEach(m => {
      (byRoom[m.room_id] ||= []).push({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.profiles?.name || 'Usuário',
        isCouple: m.profiles?.is_couple || false,
        isPro: !!m.profiles?.pro_expires_at && new Date(m.profiles.pro_expires_at) > new Date(),
        text: m.text,
        timestamp: formatClockTime(m.created_at)
      });
    });

    const membersByRoom = {};
    (members || []).forEach(m => {
      (membersByRoom[m.room_id] ||= new Set()).add(m.user_id);
    });

    const mapped = (rooms || []).map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      icon: ICONS[r.icon_key] || Flame,
      color: r.color,
      ruleType: r.rule_type,
      ruleValue: r.rule_value,
      // Real membership count from group_room_members — not the fake,
      // static number the room was originally seeded with.
      memberCount: membersByRoom[r.id]?.size || 0,
      isMember: !!currentUser && (membersByRoom[r.id]?.has(currentUser.id) || false),
      messages: byRoom[r.id] || []
    }));

    setGroups(mapped);
    setGroupsLoading(false);
    return mapped;
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.isPro) fetchGroups();
  }, [currentUser?.isPro, fetchGroups]);

  // Keep the open room's message list in sync with the source list.
  useEffect(() => {
    if (!activeGroup) return;
    const fresh = groups.find(g => g.id === activeGroup.id);
    if (fresh) setActiveGroup(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  if (!currentUser) {
    return (
      <div className="p-8 bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl text-center space-y-4 max-w-md mx-auto my-12">
        <Users className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-[var(--c-text)]">Salas de Grupos PRÓ</h3>
        <p className="text-xs text-[var(--c-accent)]">Faça login para acessar os bate-papos exclusivos de membros VIP.</p>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
        >
          Entrar na Conta
        </button>
      </div>
    );
  }

  // Group list and group messages are visible only to PRO members.
  if (!currentUser.isPro) {
    return (
      <div className="p-8 bg-gradient-to-b from-amber-950/40 via-rose-950/30 to-[var(--c-surface)] border border-amber-500/30 rounded-3xl text-center space-y-4 max-w-md mx-auto my-12 shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/20">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-[var(--c-text)]">Salas de Grupos Exclusivas PRÓ</h3>
        <p className="text-xs text-[var(--c-accent)]">
          As salas de grupo e suas mensagens são visíveis apenas para membros com <strong className="text-[var(--c-pro-text)]">Conta PRÓ</strong>. Assine para visualizar e participar.
        </p>
        <button
          onClick={() => setIsProModalOpen(true)}
          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 fill-black" /> Desbloquear com Conta PRÓ
        </button>
      </div>
    );
  }

  const handleOpenRoom = async (room) => {
    setJoinError('');

    if (room.isMember) {
      setActiveGroup(room);
      return;
    }

    if (!isEligible(currentUser, room)) {
      setJoinError(`"${room.name}": ${ruleDescription(room)}`);
      return;
    }

    setJoiningId(room.id);
    const { error } = await supabase
      .from('group_room_members')
      .insert({ room_id: room.id, user_id: currentUser.id });
    setJoiningId(null);

    if (error) {
      setJoinError('Não foi possível entrar na sala. Tente novamente.');
      return;
    }

    const fresh = await fetchGroups();
    setActiveGroup(fresh.find(g => g.id === room.id) || room);
  };

  const handleLeaveRoom = async (room) => {
    setJoiningId(room.id);
    const { error } = await supabase
      .from('group_room_members')
      .delete()
      .eq('room_id', room.id)
      .eq('user_id', currentUser.id);
    setJoiningId(null);
    if (error) {
      setJoinError('Não foi possível sair da sala. Tente novamente.');
      return;
    }
    setActiveGroup(null);
    fetchGroups();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeGroup || sending) return;

    setSending(true);
    const { data, error } = await supabase
      .from('group_room_messages')
      .insert({ room_id: activeGroup.id, sender_id: currentUser.id, text: inputMessage })
      .select()
      .single();
    setSending(false);
    if (error) return;

    const newMsg = {
      id: data.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      isCouple: currentUser.isCouple,
      isPro: currentUser.isPro,
      text: data.text,
      timestamp: formatClockTime(data.created_at)
    };

    setGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, messages: [...g.messages, newMsg] } : g));
    setInputMessage('');
  };

  const myGroups = groups.filter(g => g.isMember);
  const exploreGroups = groups.filter(g => !g.isMember);

  const renderRoomCard = (group) => {
    const GroupIcon = group.icon;
    const eligible = group.isMember || isEligible(currentUser, group);
    const rule = ruleDescription(group);

    return (
      <div
        key={group.id}
        className={`bg-[var(--c-surface)] border rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 transition group ${
          eligible ? 'border-[var(--c-border)] hover:border-amber-500/40' : 'border-[var(--c-border)] opacity-70'
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${group.color} flex items-center justify-center text-white shadow-lg`}>
              <GroupIcon className="w-6 h-6" />
            </div>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 fill-amber-400" /> VIP PRÓ
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold text-[var(--c-text)] group-hover:text-amber-400 transition">{group.name}</h3>
            <p className="text-xs text-[var(--c-text-muted)] mt-1 leading-relaxed">{group.description}</p>
          </div>

          {rule && (
            <p className={`text-[10px] font-semibold flex items-center gap-1 ${eligible ? 'text-[var(--c-text-muted)]' : 'text-amber-400'}`}>
              <ShieldAlert className="w-3 h-3 flex-shrink-0" /> {rule}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-[var(--c-border-soft)] flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--c-accent)] font-semibold flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {group.memberCount} {group.memberCount === 1 ? 'participante' : 'participantes'}
          </span>

          <button
            onClick={() => handleOpenRoom(group)}
            disabled={!eligible || joiningId === group.id}
            title={!eligible ? rule : undefined}
            className="px-4 py-2 text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 disabled:pointer-events-none flex-shrink-0"
          >
            {joiningId === group.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : group.isMember ? (
              'Abrir Sala →'
            ) : (
              'Entrar na Sala →'
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Banner — this gradient is always dark regardless of theme,
          so its text uses fixed light tones instead of the theme-swapping
          CSS variables (which turn dark-on-dark in light mode). */}
      <div className="p-6 bg-gradient-to-r from-amber-950/70 via-rose-950/70 to-purple-950/70 border border-amber-500/40 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h2 className="font-display text-xl font-semibold text-white">Salas de Grupos VIP (Exclusivo PRÓ)</h2>
          </div>
          <p className="text-xs text-amber-200">
            Conecte-se em salas de bate-papo em grupo com casais e solteiros da comunidade LoveVibe.
          </p>
        </div>
      </div>

      {groupsLoading ? (
        <div className="flex items-center justify-center py-16 text-[var(--c-text-muted)]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : activeGroup ? (
        /* Inside Active Group Chat Room */
        <div className="bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl overflow-hidden shadow-2xl h-[calc(100vh-180px)] flex flex-col">
          {/* Header */}
          <div className="p-4 bg-[var(--c-surface-2)] border-b border-[var(--c-border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveGroup(null)}
                className="p-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] rounded-xl text-[var(--c-text-secondary)] transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-2">
                  {activeGroup.name}
                  <span className="text-[9px] bg-amber-500/20 text-[var(--c-pro-text)] border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                    GRUPO PRÓ ⭐
                  </span>
                </h3>
                <p className="text-[10px] text-[var(--c-accent)]">{activeGroup.memberCount} membros participando</p>
              </div>
            </div>

            <button
              onClick={() => handleLeaveRoom(activeGroup)}
              disabled={joiningId === activeGroup.id}
              className="p-2 bg-[var(--c-overlay-5)] hover:bg-red-500/20 text-[var(--c-text-muted)] hover:text-red-400 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 text-[11px] font-semibold px-3"
              title="Sair da sala"
            >
              {joiningId === activeGroup.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Sair da Sala</span>
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--c-bg)]">
            {activeGroup.messages.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Users className="w-8 h-8 text-[var(--c-text-faint)] mx-auto" />
                <p className="text-xs text-[var(--c-text-muted)] font-semibold">Ninguém escreveu nesta sala ainda.</p>
                <p className="text-[11px] text-[var(--c-accent)]">Seja a primeira pessoa a puxar assunto!</p>
              </div>
            ) : (
              activeGroup.messages.map(msg => {
                const isMe = msg.senderId === currentUser.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-[var(--c-text-muted)] font-semibold mb-0.5 px-1 flex items-center gap-1">
                      {msg.senderName} {msg.isCouple && <span className="text-rose-400">❤️ Casal</span>}
                      {msg.isPro && <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" title="Membro PRÓ" />}
                    </span>
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-xs ${
                        isMe
                          ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-br-none shadow-md'
                          : 'bg-[var(--c-surface)] text-[var(--c-text-dim)] border border-[var(--c-border)] rounded-bl-none'
                      }`}
                    >
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                    <span className="text-[9px] text-[var(--c-text-faint)] mt-1 px-1">{msg.timestamp}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Send Input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-[var(--c-surface-2)] border-t border-[var(--c-border)] flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Escreva sua mensagem no grupo..."
              className="flex-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl px-4 py-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center disabled:opacity-60"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-8">
          {joinError && (
            <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-2xl text-red-300 text-xs font-medium text-center">
              {joinError}
            </div>
          )}

          {/* My Groups */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-500" /> Meus Grupos
            </h3>
            {myGroups.length === 0 ? (
              <div className="p-6 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl text-center">
                <p className="text-xs text-[var(--c-text-muted)]">Você ainda não entrou em nenhuma sala. Explore as opções abaixo!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myGroups.map(renderRoomCard)}
              </div>
            )}
          </div>

          {/* Explore Groups */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-2">
              <Compass className="w-4 h-4 text-rose-500" /> Explorar Grupos
            </h3>
            {exploreGroups.length === 0 ? (
              <div className="p-6 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl text-center">
                <p className="text-xs text-[var(--c-text-muted)]">Você já faz parte de todas as salas disponíveis!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exploreGroups.map(renderRoomCard)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
