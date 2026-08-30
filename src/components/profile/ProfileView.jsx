import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../context/SocialContext';
import { PostCard } from '../feed/PostCard';
import { EditProfileModal } from './EditProfileModal';
import { Avatar } from '../common/Avatar';
import { MediaLightbox } from '../common/MediaLightbox';
import { noDownloadImageProps } from '../../lib/mediaProtection';
import { useToast } from '../../context/ToastContext';
import { Users, MapPin, Calendar, Sparkles, MessageSquare, UserPlus, UserX, Check, Pencil, Target, Navigation, Info, Rss, Image as ImageIcon, Ban, ShieldCheck } from 'lucide-react';

const ABOUT_FIELDS = [
  { key: 'heightCm', label: 'Altura', format: (v) => `${v} cm` },
  { key: 'weightKg', label: 'Peso aproximado', format: (v) => `${v} kg` },
  { key: 'smokes', label: 'Fuma', format: (v) => v },
  { key: 'drinks', label: 'Bebe', format: (v) => v },
  { key: 'sexualOrientation', label: 'Orientação sexual', format: (v) => v },
  { key: 'maritalStatus', label: 'Estado civil', format: (v) => v }
];

// Every "Sobre" field renders as an inline "key: value" row, never a
// stacked title-then-value block.
const KVRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 py-2 text-xs">
    <dt className="text-[var(--c-text-muted)] font-medium flex-shrink-0">{label}</dt>
    <dd className="text-[var(--c-text)] font-semibold text-right truncate">{value}</dd>
  </div>
);

export const ProfileView = ({ user, onOpenChatWithUser, onSelectUser }) => {
  const { currentUser, setIsProModalOpen } = useAuth();
  const { posts, getFriendshipStatus, sendFriendRequest, rejectFriendRequest, isBlocked, blockUser, unblockUser } = useSocial();
  const { showToast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('posts'); // 'about' | 'posts' | 'media'
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const profileUser = user || currentUser;

  if (!profileUser) {
    return (
      <div className="p-8 text-center text-[var(--c-text-muted)]">
        Nenhum perfil selecionado.
      </div>
    );
  }

  const isMyProfile = currentUser?.id === profileUser.id;
  const friendStatus = getFriendshipStatus(profileUser.id);
  const blocked = isBlocked(profileUser.id);

  const handleSendRequest = async () => {
    const res = await sendFriendRequest(profileUser.id);
    showToast(res.success ? 'Convite enviado!' : res.message, res.success ? 'success' : 'error');
  };

  const handleCancelRequest = async () => {
    const res = await rejectFriendRequest(profileUser.id);
    showToast(res.success ? 'Convite cancelado.' : res.message, res.success ? 'success' : 'error');
  };

  const handleToggleBlock = () => {
    if (blocked) {
      unblockUser(profileUser.id);
      return;
    }
    if (window.confirm(`Bloquear ${profileUser.name}? Vocês deixam de ver o perfil, publicações e mensagens um do outro.`)) {
      blockUser(profileUser.id);
    }
  };
  const userPosts = posts.filter(p => p.userId === profileUser.id);
  const mediaPosts = userPosts.filter(p => p.mediaUrl);
  const filledAboutFields = ABOUT_FIELDS
    .map(f => ({ ...f, value: profileUser.about?.[f.key] }))
    .filter(f => f.value !== null && f.value !== '' && f.value !== undefined);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Profile Card Container */}
      <div className="bg-[var(--c-surface)] border border-rose-500/20 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Cover Image — blank gradient backdrop until the person sets a cover photo */}
        <div className="h-48 relative bg-gradient-to-r from-rose-950 to-purple-950">
          {profileUser.cover && (
            <img
              src={profileUser.cover}
              alt="Capa do Perfil"
              className="w-full h-full object-cover"
              {...noDownloadImageProps}
            />
          )}
        </div>

        {/* Profile Info Header */}
        <div className="px-6 pb-6 relative -mt-16 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            {/* Avatar(s) */}
            <div className="relative inline-block">
              <Avatar
                src={profileUser.avatar}
                alt={profileUser.name}
                isCouple={profileUser.isCouple}
                className="w-24 h-24 rounded-3xl object-cover ring-4 ring-[var(--c-surface)] shadow-xl"
              />
              {profileUser.isCouple && (
                <span className="absolute -bottom-2 -right-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg border border-black flex items-center gap-1">
                  ❤️ CASAL
                </span>
              )}
            </div>

            {/* Actions Header */}
            <div className="flex items-center gap-2">
              {isMyProfile ? (
                <>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-4 py-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] text-[var(--c-text)] font-bold text-xs rounded-xl border border-[var(--c-border)] transition flex items-center gap-1.5"
                  >
                    <Pencil className="w-4 h-4 text-rose-400" /> Editar Perfil
                  </button>
                  <button
                    onClick={() => setIsProModalOpen(true)}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl shadow-lg transition flex items-center gap-1.5 ${
                      profileUser.isPro
                        ? 'bg-amber-500/20 text-[var(--c-pro-text)] border border-amber-500/50'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 fill-current" />
                    {profileUser.isPro ? 'Plano VIP Ativo' : 'Virar VIP'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onOpenChatWithUser(profileUser)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-4 h-4" /> Enviar Mensagem
                  </button>

                  {friendStatus === 'NONE' && (
                    <button
                      onClick={handleSendRequest}
                      className="px-4 py-2 bg-[var(--c-overlay-5)] hover:bg-rose-500/20 text-[var(--c-text-dim)] border border-[var(--c-border)] rounded-xl font-bold text-xs transition flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4 text-rose-400" /> Solicitar Amizade
                    </button>
                  )}
                  {friendStatus === 'SENT' && (
                    <button
                      onClick={handleCancelRequest}
                      title="Cancelar convite"
                      className="px-3 py-2 bg-[var(--c-overlay-5)] hover:bg-red-500/10 text-[var(--c-text-muted)] hover:text-red-400 text-xs font-semibold rounded-xl border border-[var(--c-border)] hover:border-red-500/30 transition flex items-center gap-1"
                    >
                      <UserX className="w-3.5 h-3.5" /> Cancelar Convite
                    </button>
                  )}

                  <button
                    onClick={handleToggleBlock}
                    title={blocked ? 'Desbloquear usuário' : 'Bloquear usuário'}
                    className={`px-3 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 border ${
                      blocked
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                        : 'bg-[var(--c-overlay-5)] hover:bg-red-500/10 border-[var(--c-border)] text-[var(--c-text-muted)] hover:text-red-400'
                    }`}
                  >
                    {blocked ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    {blocked ? 'Desbloquear' : 'Bloquear'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* User Details Name & Bio */}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-[var(--c-text)]">{profileUser.name}</h2>
              {profileUser.isPro && (
                <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" title="Membro VIP" />
              )}
            </div>

            <p className="text-xs text-[var(--c-accent)] mt-0.5 font-medium">
              @{profileUser.username} • {profileUser.isCouple ? `Casal (${profileUser.age} anos)` : `${profileUser.gender}, ${profileUser.age} anos`}
            </p>

            <p className="text-xs text-[var(--c-text-dim)] mt-3 leading-relaxed">
              {profileUser.bio}
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[var(--c-text-muted)] font-medium">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> {profileUser.location || 'Brasil'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-purple-400" /> No LoveVibe desde {profileUser.joinedDate || '2025'}
              </span>
            </div>
          </div>

          {/* DUAL PARTNERS DISPLAY (If Couple) */}
          {profileUser.isCouple && (
            <div className="p-4 bg-[var(--c-surface-2)] border border-rose-500/30 rounded-2xl space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-rose-400 text-xs font-bold flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Integrantes do Casal:
                </span>
                <span className="text-[10px] text-[var(--c-accent)] font-semibold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  {profileUser.partner1?.gender || 'Masculino'} & {profileUser.partner2?.gender || 'Feminino'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Partner 1 */}
                <div className="p-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl flex items-center gap-3">
                  <Avatar
                    src={profileUser.partner1?.avatar || profileUser.avatar}
                    alt={profileUser.partner1?.name || 'Parceiro 1'}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-rose-500/50"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-[var(--c-text)]">{profileUser.partner1?.name || 'Parceiro 1'}</h4>
                    <p className="text-[10px] text-[var(--c-accent)] font-medium">
                      Sexo: <span className="text-[var(--c-text)] font-semibold">{profileUser.partner1?.gender || 'Masculino'}</span> • {profileUser.partner1?.age || '28'} anos
                    </p>
                  </div>
                </div>

                {/* Partner 2 */}
                <div className="p-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl flex items-center gap-3">
                  <Avatar
                    src={profileUser.partner2?.avatar || profileUser.avatar}
                    alt={profileUser.partner2?.name || 'Parceiro 2'}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-pink-500/50"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-[var(--c-text)]">{profileUser.partner2?.name || 'Parceiro 2'}</h4>
                    <p className="text-[10px] text-pink-300 font-medium">
                      Sexo: <span className="text-[var(--c-text)] font-semibold">{profileUser.partner2?.gender || 'Feminino'}</span> • {profileUser.partner2?.age || '26'} anos
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Preferences — visible to everyone viewing this profile */}
          {profileUser.preferences && (
            <div className="p-4 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-2xl space-y-2 mt-4">
              <span className="text-[var(--c-accent)] text-xs font-bold flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Interesse
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--c-text-muted)] font-medium">
                <span>
                  Idade: <span className="text-[var(--c-text)] font-semibold">{profileUser.preferences.ageMin}–{profileUser.preferences.ageMax} anos</span>
                </span>
                <span>
                  Sexo: <span className="text-[var(--c-text)] font-semibold">
                    {profileUser.preferences.genders?.length > 0 ? profileUser.preferences.genders.join(', ') : 'Qualquer'}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-rose-400" />
                  Até <span className="text-[var(--c-text)] font-semibold">{profileUser.preferences.radiusKm}km</span> de {profileUser.location || 'sua cidade'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section Tabs: About / Posts / Media */}
      <div className="flex bg-[var(--c-surface-2)] p-1 rounded-2xl border border-[var(--c-border)]">
        {[
          { id: 'about', label: 'Sobre', icon: Info },
          { id: 'posts', label: 'Publicações', icon: Rss },
          { id: 'media', label: 'Mídias', icon: ImageIcon }
        ].map(t => {
          const TabIcon = t.icon;
          const isActive = activeSection === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSection(t.id)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {activeSection === 'about' && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-5 space-y-5">
          {/* Basic info — always present, always "chave: valor" */}
          <div>
            <h4 className="text-[10px] font-bold text-[var(--c-text-muted)] uppercase tracking-wider mb-1">Informações Básicas</h4>
            <dl className="divide-y divide-[var(--c-border-soft)]">
              <KVRow label="Nome" value={profileUser.name} />
              <KVRow label="Usuário" value={`@${profileUser.username}`} />
              <KVRow label="Sexo" value={profileUser.isCouple ? 'Casal' : profileUser.gender} />
              <KVRow label="Idade" value={`${profileUser.age} anos`} />
              <KVRow label="Localização" value={profileUser.location || 'Não informado'} />
              {profileUser.bio && <KVRow label="Biografia" value={profileUser.bio} />}
              <KVRow label="No LoveVibe desde" value={profileUser.joinedDate || '2025'} />
            </dl>
          </div>

          {/* Interest (search preferences) — same key:value format */}
          {profileUser.preferences && (
            <div>
              <h4 className="text-[10px] font-bold text-[var(--c-text-muted)] uppercase tracking-wider mb-1">Interesse</h4>
              <dl className="divide-y divide-[var(--c-border-soft)]">
                <KVRow label="Idade" value={`${profileUser.preferences.ageMin}–${profileUser.preferences.ageMax} anos`} />
                <KVRow
                  label="Sexo"
                  value={profileUser.preferences.genders?.length > 0 ? profileUser.preferences.genders.join(', ') : 'Qualquer'}
                />
                <KVRow label="Distância" value={`Até ${profileUser.preferences.radiusKm}km de ${profileUser.location || 'sua cidade'}`} />
              </dl>
            </div>
          )}

          {/* Optional extra info */}
          <div>
            <h4 className="text-[10px] font-bold text-[var(--c-text-muted)] uppercase tracking-wider mb-1">Mais sobre {profileUser.name}</h4>
            {filledAboutFields.length === 0 ? (
              <p className="text-xs text-[var(--c-text-faint)] py-2">
                {isMyProfile
                  ? 'Você ainda não adicionou essas informações. Vá em "Editar Perfil" para preencher.'
                  : 'Esta pessoa ainda não adicionou essas informações.'}
              </p>
            ) : (
              <dl className="divide-y divide-[var(--c-border-soft)]">
                {filledAboutFields.map(f => (
                  <KVRow key={f.key} label={f.label} value={f.format(f.value)} />
                ))}
              </dl>
            )}
          </div>
        </div>
      )}

      {activeSection === 'posts' && (
        <div className="space-y-4">
          {userPosts.length === 0 ? (
            <div className="text-center py-12 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl text-xs text-[var(--c-text-faint)]">
              Nenhuma publicação ainda.
            </div>
          ) : (
            userPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onOpenChatWithUser={onOpenChatWithUser}
                onSelectUser={onSelectUser}
              />
            ))
          )}
        </div>
      )}

      {activeSection === 'media' && (
        mediaPosts.length === 0 ? (
          <div className="text-center py-12 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl text-xs text-[var(--c-text-faint)]">
            Nenhuma foto publicada ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {mediaPosts.map(post => (
              <button
                key={post.id}
                onClick={() => setLightboxSrc(post.mediaUrl)}
                className="aspect-square rounded-2xl overflow-hidden border border-[var(--c-border)] group"
              >
                <img
                  src={post.mediaUrl}
                  alt="Mídia publicada"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  {...noDownloadImageProps}
                />
              </button>
            ))}
          </div>
        )
      )}

      <MediaLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {isMyProfile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          user={currentUser}
        />
      )}
    </div>
  );
};
