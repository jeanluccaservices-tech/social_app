import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { useToast } from '../../context/ToastContext';
import { MatchTab } from './MatchTab';
import { Avatar } from '../common/Avatar';
import { isWithinRadius } from '../../lib/geo';
import { GENDERS, MIN_RADIUS_KM, MAX_RADIUS_KM, sanitizeRadiusInput, clampRadius } from '../../lib/constants';
import { Users, UserCheck, UserPlus, UserX, Check, X, MessageSquare, Sparkles, UserMinus, Search, LayoutGrid, List, Heart, MapPin, Loader2, SlidersHorizontal, Lock } from 'lucide-react';

export const FriendsList = ({ onOpenChatWithUser, onSelectUser }) => {
  const { currentUser, users, setIsAuthModalOpen, setIsProModalOpen } = useAuth();
  const { friendships, contactsLoading, acceptFriendRequest, rejectFriendRequest, sendFriendRequest, removeFriend, getFriendshipStatus } = useSocial();
  const { showToast } = useToast();
  const [tab, setTab] = useState('friends'); // 'friends' | 'requests' | 'explore' | 'match'
  const [exploreView, setExploreView] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');

  // Explore / Match filters — default to the preferences saved in Editar
  // Perfil, so suggestions start already narrowed the way the person
  // asked for; still freely adjustable per-session from here.
  const [showFilters, setShowFilters] = useState(false);
  const [filterGenders, setFilterGenders] = useState(() => currentUser?.preferences?.genders || []);
  const [filterAgeMin, setFilterAgeMin] = useState(() => currentUser?.preferences?.ageMin ?? '');
  const [filterAgeMax, setFilterAgeMax] = useState(() => currentUser?.preferences?.ageMax ?? '');
  const [filterRadiusKm, setFilterRadiusKm] = useState(() => currentUser?.preferences?.radiusKm ?? '');

  const toggleFilterGender = (g) => {
    setFilterGenders(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  if (!currentUser) {
    return (
      <div className="p-8 bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl text-center space-y-4 max-w-md mx-auto my-12">
        <Users className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-[var(--c-text)]">Conexões & Amizades</h3>
        <p className="text-xs text-[var(--c-accent)]">Faça login para gerenciar seus amigos e enviar solicitações.</p>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
        >
          Entrar na Conta
        </button>
      </div>
    );
  }

  // Accepted friends
  const myFriends = users.filter(u => {
    if (u.id === currentUser.id) return false;
    return friendships.some(f =>
      f.status === 'ACCEPTED' &&
      ((f.userId1 === currentUser.id && f.userId2 === u.id) ||
       (f.userId1 === u.id && f.userId2 === currentUser.id))
    );
  });

  // Pending incoming requests
  const pendingRequests = users.filter(u => {
    if (u.id === currentUser.id) return false;
    return friendships.some(f =>
      f.status === 'PENDING' && f.userId1 === u.id && f.userId2 === currentUser.id
    );
  });

  // Explore suggestions (not friends and no pending request), narrowed by
  // the optional gender / age / distance filters.
  const exploreUsers = users.filter(u => {
    if (u.id === currentUser.id) return false;
    const status = getFriendshipStatus(u.id);
    if (status !== 'NONE' && status !== 'SENT') return false;

    if (filterGenders.length > 0) {
      const g = u.isCouple ? 'Casal' : u.gender;
      if (!filterGenders.includes(g)) return false;
    }

    if (filterAgeMin || filterAgeMax) {
      const age = u.isCouple
        ? Math.min(Number(u.partner1?.age) || 0, Number(u.partner2?.age) || 0)
        : Number(u.age) || 0;
      if (filterAgeMin && age < Number(filterAgeMin)) return false;
      if (filterAgeMax && age > Number(filterAgeMax)) return false;
    }

    if (filterRadiusKm && !isWithinRadius(currentUser.location, u.location, Number(filterRadiusKm))) {
      return false;
    }

    return true;
  });

  // The swipe deck should never resurface someone you've already invited
  // (or who's already a friend/pending) — exploreUsers deliberately keeps
  // 'SENT' profiles (so the Explore grid can show "Enviado"), but Match
  // needs the stricter list.
  const matchCandidates = exploreUsers.filter(u => getFriendshipStatus(u.id) === 'NONE');

  const hasActiveFilters = filterGenders.length > 0 || filterAgeMin || filterAgeMax || filterRadiusKm;

  const filteredList = (list) => list.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExplore = filteredList(exploreUsers);

  const handleSendRequest = async (targetUserId) => {
    const res = await sendFriendRequest(targetUserId);
    showToast(res.success ? 'Convite enviado!' : res.message, res.success ? 'success' : 'error');
  };

  const handleCancelRequest = async (targetUserId) => {
    const res = await rejectFriendRequest(targetUserId);
    showToast(res.success ? 'Convite cancelado.' : res.message, res.success ? 'success' : 'error');
  };

  const handleMatchLike = async (targetUserId) => {
    const res = await sendFriendRequest(targetUserId);
    showToast(res.success ? 'Convite enviado!' : res.message, res.success ? 'success' : 'error');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Tabs */}
      <div className="p-4 bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-[var(--c-text)] flex items-center gap-2">
            <Users className="w-5 h-5 text-rose-500" /> Rede de Amizades & Conexões
          </h2>

          {tab !== 'match' && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--c-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome..."
                className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl py-2 pl-9 pr-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
              />
            </div>
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-[var(--c-bg)] p-1 rounded-2xl border border-[var(--c-border)] overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTab('friends')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 whitespace-nowrap ${
              tab === 'friends' ? 'bg-rose-600 text-white shadow-md' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Amigos ({myFriends.length})
          </button>

          <button
            onClick={() => setTab('requests')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 whitespace-nowrap ${
              tab === 'requests' ? 'bg-rose-600 text-white shadow-md' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
            }`}
          >
            <UserPlus className="w-4 h-4" /> Convites ({pendingRequests.length})
            {pendingRequests.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('explore')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 whitespace-nowrap ${
              tab === 'explore' ? 'bg-rose-600 text-white shadow-md' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" /> Explorar
          </button>

          <button
            onClick={() => setTab('match')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 whitespace-nowrap ${
              tab === 'match' ? 'bg-rose-600 text-white shadow-md' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
            }`}
          >
            <Heart className="w-4 h-4" /> Match
            <span className="text-[8px] bg-amber-500 text-black px-1.5 py-0.3 rounded-full font-black">VIP</span>
          </button>
        </div>
      </div>

      {/* Explore / Match filters — gender, age range, distance */}
      {(tab === 'explore' || tab === 'match') && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl shadow-lg overflow-hidden">
          <button
            onClick={() => {
              const closing = showFilters;
              setShowFilters(!showFilters);
              if (closing && hasActiveFilters) showToast('Filtros aplicados.', 'success');
            }}
            className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-[var(--c-text)]"
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-rose-500" /> Filtros
              {hasActiveFilters && (
                <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.3 rounded-full">Ativos</span>
              )}
            </span>
            <span className="text-[var(--c-text-muted)]">{showFilters ? '−' : '+'}</span>
          </button>

          {showFilters && (
            <div className="p-3.5 pt-0 space-y-3 border-t border-[var(--c-border-soft)]">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1.5">Sexo</label>
                <div className="flex flex-wrap gap-1.5">
                  {[...GENDERS, 'Casal'].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleFilterGender(g)}
                      className={`py-1.5 px-2.5 text-[10px] font-bold rounded-lg border transition ${
                        filterGenders.includes(g)
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-[var(--c-surface-3)] border-[var(--c-border)] text-[var(--c-text-muted)] hover:border-[var(--c-border-strong)]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Idade Mín.</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={18}
                    max={100}
                    value={filterAgeMin}
                    onChange={(e) => setFilterAgeMin(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    placeholder="18"
                    className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Idade Máx.</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={18}
                    max={100}
                    value={filterAgeMax}
                    onChange={(e) => setFilterAgeMax(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    placeholder="100"
                    className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Raio (km)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MIN_RADIUS_KM}
                    max={MAX_RADIUS_KM}
                    value={filterRadiusKm}
                    onChange={(e) => setFilterRadiusKm(sanitizeRadiusInput(e.target.value))}
                    onBlur={(e) => setFilterRadiusKm(clampRadius(e.target.value))}
                    placeholder={`de ${currentUser.location || 'sua cidade'}`}
                    className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterGenders([]); setFilterAgeMin(''); setFilterAgeMax(''); setFilterRadiusKm('');
                    showToast('Filtros removidos.', 'success');
                  }}
                  className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {contactsLoading && (
        <div className="flex items-center justify-center py-16 text-[var(--c-text-muted)]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {/* Tab 1: Friends List */}
      {!contactsLoading && tab === 'friends' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredList(myFriends).length === 0 ? (
            <div className="col-span-2 text-center py-12 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl space-y-2">
              <Users className="w-10 h-10 text-[var(--c-text-faint)] mx-auto" />
              <p className="text-xs text-[var(--c-text-muted)] font-semibold">Você ainda não possui amigos adicionados.</p>
              <p className="text-[11px] text-[var(--c-accent)]">Vá na aba "Explorar" ou "Match" para enviar convites!</p>
            </div>
          ) : (
            filteredList(myFriends).map(u => (
              <div key={u.id} className="p-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl flex items-center justify-between gap-3 shadow-lg">
                <div onClick={() => onSelectUser(u)} className="flex items-center gap-3 cursor-pointer overflow-hidden">
                  <Avatar src={u.avatar} alt={u.name} isCouple={u.isCouple} className="w-12 h-12 rounded-full object-cover ring-2 ring-rose-500/40" />
                  <div className="overflow-hidden">
                    <h4 className="text-sm font-bold text-[var(--c-text)] truncate flex items-center gap-1">
                      {u.name} {u.isCouple && '❤️'}
                    </h4>
                    <p className="text-[10px] text-[var(--c-accent)]">
                      {u.isCouple ? 'Casal' : u.gender} • @{u.username}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenChatWithUser(u)}
                    className="p-2 bg-rose-600/20 hover:bg-rose-600/30 text-[var(--c-accent)] border border-rose-500/40 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      const res = await removeFriend(u.id);
                      showToast(res.success ? 'Amizade desfeita.' : res.message, res.success ? 'success' : 'error');
                    }}
                    title="Desfazer amizade"
                    className="p-2 bg-[var(--c-overlay-5)] hover:bg-red-500/20 text-[var(--c-text-muted)] hover:text-red-400 rounded-xl transition"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Pending Requests */}
      {!contactsLoading && tab === 'requests' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredList(pendingRequests).length === 0 ? (
            <div className="col-span-2 text-center py-12 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl space-y-2">
              <UserCheck className="w-10 h-10 text-[var(--c-text-faint)] mx-auto" />
              <p className="text-xs text-[var(--c-text-muted)] font-semibold">Nenhuma solicitação de amizade pendente.</p>
            </div>
          ) : (
            filteredList(pendingRequests).map(u => (
              <div key={u.id} className="p-4 bg-[var(--c-surface)] border border-rose-500/30 rounded-3xl flex items-center justify-between gap-3 shadow-lg">
                <div onClick={() => onSelectUser(u)} className="flex items-center gap-3 cursor-pointer overflow-hidden">
                  <Avatar src={u.avatar} alt={u.name} isCouple={u.isCouple} className="w-12 h-12 rounded-full object-cover ring-2 ring-rose-500/40" />
                  <div className="overflow-hidden">
                    <h4 className="text-sm font-bold text-[var(--c-text)] truncate">{u.name}</h4>
                    <p className="text-[10px] text-[var(--c-accent)]">@{u.username} quer ser seu amigo</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const res = await acceptFriendRequest(u.id);
                      showToast(res.success ? `Vocês agora são amigos!` : res.message, res.success ? 'success' : 'error');
                    }}
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Aceitar
                  </button>
                  <button
                    onClick={async () => {
                      const res = await rejectFriendRequest(u.id);
                      showToast(res.success ? 'Convite recusado.' : res.message, res.success ? 'success' : 'error');
                    }}
                    className="p-2 bg-[var(--c-overlay-10)] hover:bg-red-500/20 text-[var(--c-text-muted)] hover:text-red-400 rounded-xl transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Explore Users */}
      {!contactsLoading && tab === 'explore' && (
        <div className="space-y-4">
          {/* List / Grid view toggle */}
          <div className="flex justify-end">
            <div className="flex bg-[var(--c-bg)] p-1 rounded-xl border border-[var(--c-border)]">
              <button
                onClick={() => setExploreView('grid')}
                className={`p-2 rounded-lg transition ${exploreView === 'grid' ? 'bg-rose-600 text-white' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'}`}
                title="Ver em quadros"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setExploreView('list')}
                className={`p-2 rounded-lg transition ${exploreView === 'list' ? 'bg-rose-600 text-white' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'}`}
                title="Ver em lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Results summary — always visible, so it's obvious the list
              reflects the active filters even when nothing changes visually. */}
          <p className="text-[11px] text-[var(--c-text-muted)] px-1">
            {hasActiveFilters ? (
              <>
                <span className="font-semibold text-[var(--c-text-secondary)]">{filteredExplore.length}</span> {filteredExplore.length === 1 ? 'perfil encontrado' : 'perfis encontrados'} com os filtros aplicados.
              </>
            ) : (
              <>
                <span className="font-semibold text-[var(--c-text-secondary)]">{filteredExplore.length}</span> {filteredExplore.length === 1 ? 'perfil disponível' : 'perfis disponíveis'} para explorar.
              </>
            )}
          </p>

          {filteredExplore.length === 0 ? (
            <div className="text-center py-12 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl space-y-2">
              <Sparkles className="w-10 h-10 text-[var(--c-text-faint)] mx-auto" />
              <p className="text-xs font-semibold text-[var(--c-text-muted)]">Nenhum perfil encontrado.</p>
              {hasActiveFilters ? (
                <>
                  <p className="text-[11px] text-[var(--c-accent)]">Tente ajustar ou limpar os filtros para ver mais gente.</p>
                  <button
                    onClick={() => { setFilterGenders([]); setFilterAgeMin(''); setFilterAgeMax(''); setFilterRadiusKm(''); showToast('Filtros removidos.', 'success'); }}
                    className="mt-1 px-4 py-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] text-xs font-bold text-[var(--c-text-secondary)] rounded-xl border border-[var(--c-border)] transition"
                  >
                    Limpar filtros
                  </button>
                </>
              ) : (
                <p className="text-[11px] text-[var(--c-accent)]">Volte mais tarde para ver novos perfis.</p>
              )}
            </div>
          ) : exploreView === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredExplore.map(u => {
                const status = getFriendshipStatus(u.id);
                return (
                  <div key={u.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] hover:border-rose-500/30 rounded-3xl overflow-hidden shadow-lg transition flex flex-col">
                    <div onClick={() => onSelectUser(u)} className="cursor-pointer">
                      <Avatar src={u.avatar} alt={u.name} isCouple={u.isCouple} className="w-full h-40 object-cover" />
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-2">
                      <div onClick={() => onSelectUser(u)} className="cursor-pointer">
                        <h4 className="text-sm font-bold text-[var(--c-text)] truncate flex items-center gap-1.5">
                          {u.name}
                          {u.isCouple && <span className="text-xs text-rose-400">❤️</span>}
                          {u.isPro && <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" title="Membro VIP" />}
                        </h4>
                        <p className="text-[10px] text-[var(--c-accent)] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {u.isCouple ? 'Casal' : u.gender} • {u.location || 'Brasil'}
                        </p>
                        {u.bio && (
                          <p className="text-[11px] text-[var(--c-text-muted)] mt-1.5 line-clamp-2">{u.bio}</p>
                        )}
                      </div>

                      <div className="mt-auto pt-2">
                        {status === 'SENT' ? (
                          <button
                            onClick={() => handleCancelRequest(u.id)}
                            className="w-full py-1.5 bg-[var(--c-overlay-5)] hover:bg-red-500/10 border border-[var(--c-border)] hover:border-red-500/30 text-[var(--c-text-muted)] hover:text-red-400 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                          >
                            <UserX className="w-3.5 h-3.5" /> Cancelar convite
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(u.id)}
                            className="w-full py-1.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExplore.map(u => {
                const status = getFriendshipStatus(u.id);
                return (
                  <div key={u.id} className="p-4 bg-[var(--c-surface)] border border-[var(--c-border)] hover:border-rose-500/30 rounded-3xl flex items-center justify-between gap-3 shadow-lg transition">
                    <div onClick={() => onSelectUser(u)} className="flex items-center gap-3 cursor-pointer overflow-hidden">
                      <Avatar src={u.avatar} alt={u.name} isCouple={u.isCouple} className="w-12 h-12 rounded-full object-cover border-2 border-rose-500/40 flex-shrink-0" />
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-bold text-[var(--c-text)] truncate flex items-center gap-1.5">
                          {u.name}
                          {u.isCouple && <span className="text-xs text-rose-400">❤️</span>}
                          {u.isPro && <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" title="Membro VIP" />}
                        </h4>
                        <p className="text-[10px] text-[var(--c-accent)]">
                          {u.isCouple ? 'Casal' : u.gender} • {u.location}
                        </p>
                        {u.bio && (
                          <p className="text-[11px] text-[var(--c-text-muted)] truncate mt-0.5">{u.bio}</p>
                        )}
                      </div>
                    </div>

                    {status === 'SENT' ? (
                      <button
                        onClick={() => handleCancelRequest(u.id)}
                        className="px-3.5 py-2 bg-[var(--c-overlay-5)] hover:bg-red-500/10 border border-[var(--c-border)] hover:border-red-500/30 text-[var(--c-text-muted)] hover:text-red-400 rounded-xl text-xs font-semibold transition flex items-center gap-1 flex-shrink-0"
                      >
                        <UserX className="w-3.5 h-3.5" /> Cancelar convite
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(u.id)}
                        className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 flex-shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Adicionar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Match (swipe) — exclusive to PRO members */}
      {!contactsLoading && tab === 'match' && (
        currentUser.isPro ? (
          <MatchTab
            candidates={matchCandidates}
            onLike={handleMatchLike}
            onSelectUser={onSelectUser}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => { setFilterGenders([]); setFilterAgeMin(''); setFilterAgeMax(''); setFilterRadiusKm(''); showToast('Filtros removidos.', 'success'); }}
          />
        ) : (
          <div className="p-8 bg-gradient-to-b from-amber-950/40 via-rose-950/30 to-[var(--c-surface)] border border-amber-500/30 rounded-3xl text-center space-y-4 max-w-md mx-auto shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/20">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-[var(--c-text)]">Match Exclusivo VIP</h3>
            <p className="text-xs text-[var(--c-accent)]">
              O modo Match (swipe) é um recurso exclusivo para membros com <strong className="text-[var(--c-pro-text)]">Conta VIP</strong>. Assine para curtir e encontrar novas conexões.
            </p>
            <button
              onClick={() => setIsProModalOpen(true)}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-black" /> Desbloquear com Conta VIP
            </button>
          </div>
        )
      )}
    </div>
  );
};
