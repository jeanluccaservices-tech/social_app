import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { stripEmojis } from '../../utils/text';
import { uploadImage } from '../../lib/storage';
import { X, Camera, Image as ImageIcon, MapPin, Target, Users, Save, Loader2, Cake, Navigation, Lock, Info, KeyRound, AlertTriangle, Check } from 'lucide-react';
import {
  GENDERS, MIN_AGE, MAX_AGE, sanitizeAgeInput, clampAge, MIN_BIRTH_DATE, MAX_BIRTH_DATE,
  SEXUAL_ORIENTATIONS, MARITAL_STATUSES, SMOKE_DRINK_OPTIONS,
  MIN_RADIUS_KM, MAX_RADIUS_KM, sanitizeRadiusInput, clampRadius
} from '../../lib/constants';
import { CitySelect } from '../common/CitySelect';
import { Avatar } from '../common/Avatar';

export const EditProfileModal = ({ isOpen, onClose, user }) => {
  const { updateProfile, changePassword, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null); // { type: 'error' | 'success', text }

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [cover, setCover] = useState(user?.cover || '');

  const [name, setName] = useState(user?.name || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');

  const [p1Name, setP1Name] = useState(user?.partner1?.name || '');
  const [p1BirthDate, setP1BirthDate] = useState(user?.partner1?.birthDate || '');
  const [p2Name, setP2Name] = useState(user?.partner2?.name || '');
  const [p2BirthDate, setP2BirthDate] = useState(user?.partner2?.birthDate || '');

  const [prefAgeMin, setPrefAgeMin] = useState(user?.preferences?.ageMin ?? 18);
  const [prefAgeMax, setPrefAgeMax] = useState(user?.preferences?.ageMax ?? 99);
  const [prefGenders, setPrefGenders] = useState(user?.preferences?.genders || []);
  const [prefRadiusKm, setPrefRadiusKm] = useState(user?.preferences?.radiusKm ?? 50);

  const [heightCm, setHeightCm] = useState(user?.about?.heightCm || '');
  const [weightKg, setWeightKg] = useState(user?.about?.weightKg || '');
  const [smokes, setSmokes] = useState(user?.about?.smokes || '');
  const [drinks, setDrinks] = useState(user?.about?.drinks || '');
  const [sexualOrientation, setSexualOrientation] = useState(user?.about?.sexualOrientation || '');
  const [maritalStatus, setMaritalStatus] = useState(user?.about?.maritalStatus || '');

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  if (!isOpen || !user) return null;

  const togglePrefGender = (g) => {
    setPrefGenders(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const handleFileChange = async (e, setter, setUploading) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage('avatars', user.id, file);
      setter(url);
    } catch {
      // upload failed silently; user can retry
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const updates = {
      avatar,
      cover,
      bio,
      location,
      preferences: {
        ageMin: Number(prefAgeMin) || 18,
        ageMax: Number(prefAgeMax) || 99,
        genders: prefGenders,
        radiusKm: Number(prefRadiusKm) || 50
      },
      about: {
        heightCm: heightCm || null,
        weightKg: weightKg || null,
        smokes,
        drinks,
        sexualOrientation,
        maritalStatus
      }
    };

    if (user.isCouple) {
      updates.name = `${p1Name} & ${p2Name}`;
      // Gender is fixed at signup — updateProfile() re-asserts it from
      // currentUser regardless of what's sent here, so it's left out
      // entirely rather than carrying forward the derived `age` that
      // user.partner1/2 also holds (that's recomputed from birthDate on
      // every load, so storing it back would just be stale dead weight).
      updates.partner1 = { name: p1Name, birthDate: p1BirthDate };
      updates.partner2 = { name: p2Name, birthDate: p2BirthDate };
    } else {
      updates.name = name;
      updates.birthDate = birthDate;
    }

    setSaving(true);
    await updateProfile(updates);
    setSaving(false);
    onClose();
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ type: 'error', text: 'Preencha a senha atual e a nova senha.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'A confirmação não confere com a nova senha.' });
      return;
    }

    setChangingPassword(true);
    const res = await changePassword(currentPassword, newPassword);
    setChangingPassword(false);

    if (!res.success) {
      setPasswordMsg({ type: 'error', text: res.message });
      return;
    }
    setPasswordMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'EXCLUIR') return;
    setDeleteError('');
    setDeletingAccount(true);
    const res = await deleteAccount();
    setDeletingAccount(false);

    if (!res.success) {
      setDeleteError(res.message);
      return;
    }
    showToast('Sua conta foi excluída definitivamente. Essa ação não pode ser desfeita.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[var(--c-surface)] border border-rose-500/30 rounded-3xl shadow-2xl shadow-rose-950/50 overflow-hidden my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-[var(--c-text-muted)] hover:text-[var(--c-text)] p-2 rounded-full hover:bg-[var(--c-overlay-10)] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cover + Avatar preview with change controls */}
        <div className="relative h-36 bg-gradient-to-r from-rose-950 to-purple-950">
          {cover && <img src={cover} alt="Capa" className="w-full h-full object-cover" />}
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 border border-white/20 rounded-xl text-[11px] font-bold text-white transition disabled:opacity-60"
          >
            {uploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            {uploadingCover ? 'Enviando...' : 'Trocar Capa'}
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, setCover, setUploadingCover)} />

          <div className="absolute -bottom-10 left-6">
            <div className="relative">
              <Avatar src={avatar} alt="Avatar" isCouple={user.isCouple} className="w-20 h-20 rounded-2xl object-cover ring-4 ring-[var(--c-surface)] shadow-xl" />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-rose-600 hover:bg-rose-500 rounded-full text-white shadow-lg transition disabled:opacity-60"
              >
                {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, setAvatar, setUploadingAvatar)} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 pt-14 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <h2 className="text-lg font-bold text-[var(--c-text)]">Editar Perfil</h2>
            <p className="text-[11px] text-[var(--c-text-faint)]">@{user.username} <span className="text-[var(--c-text-verydim)]">(nome de usuário não pode ser alterado)</span></p>
          </div>

          {user.isCouple ? (
            <div className="space-y-3 p-3 bg-rose-950/20 border border-rose-500/30 rounded-2xl">
              <span className="text-rose-400 font-bold text-xs flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Integrantes do Casal:
              </span>
              <p className="text-[10px] text-[var(--c-text-faint)] -mt-2">
                Pode usar o nome ou um apelido de cada integrante. A data de nascimento é usada para calcular a idade automaticamente.
              </p>

              <div className="bg-[var(--c-surface-3)] p-3 rounded-xl border border-[var(--c-border)] space-y-2">
                <span className="text-[11px] font-bold text-[var(--c-accent)]">Integrante 1:</span>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={p1Name} onChange={e => setP1Name(stripEmojis(e.target.value))} placeholder="Nome ou apelido"
                    className="col-span-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500" />
                  <input type="date" min={MIN_BIRTH_DATE} max={MAX_BIRTH_DATE} value={p1BirthDate}
                    onChange={e => setP1BirthDate(e.target.value)}
                    className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2 text-[11px] text-[var(--c-text)] focus:outline-none focus:border-rose-500" />
                  <div
                    title="O sexo não pode ser alterado após o cadastro"
                    className="flex items-center justify-center gap-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2 text-xs text-[var(--c-text-muted)]"
                  >
                    <Lock className="w-3 h-3 flex-shrink-0" /> {user.partner1?.gender}
                  </div>
                </div>
              </div>

              <div className="bg-[var(--c-surface-3)] p-3 rounded-xl border border-[var(--c-border)] space-y-2">
                <span className="text-[11px] font-bold text-[var(--c-accent)]">Integrante 2:</span>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={p2Name} onChange={e => setP2Name(stripEmojis(e.target.value))} placeholder="Nome ou apelido"
                    className="col-span-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500" />
                  <input type="date" min={MIN_BIRTH_DATE} max={MAX_BIRTH_DATE} value={p2BirthDate}
                    onChange={e => setP2BirthDate(e.target.value)}
                    className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2 text-[11px] text-[var(--c-text)] focus:outline-none focus:border-rose-500" />
                  <div
                    title="O sexo não pode ser alterado após o cadastro"
                    className="flex items-center justify-center gap-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2 text-xs text-[var(--c-text-muted)]"
                  >
                    <Lock className="w-3 h-3 flex-shrink-0" /> {user.partner2?.gender}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">Nome Completo</label>
                <input type="text" value={name} onChange={(e) => setName(stripEmojis(e.target.value))}
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-0.5 flex items-center gap-1">
                  <Cake className="w-3.5 h-3.5 text-rose-400" /> Nascimento
                </label>
                <p className="text-[10px] text-[var(--c-text-faint)] mb-1">Usada para calcular sua idade automaticamente.</p>
                <input type="date" min={MIN_BIRTH_DATE} max={MAX_BIRTH_DATE} value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">Sexo</label>
                <div
                  title="O sexo não pode ser alterado após o cadastro"
                  className="flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-3)] text-[var(--c-text-secondary)]"
                >
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" /> {user.gender}
                  <span className="text-[10px] font-normal text-[var(--c-text-faint)] ml-auto">Não pode ser alterado</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">Biografia</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre você..."
              className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl p-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500 resize-none h-20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-400" /> Localização
            </label>
            <CitySelect value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Selecione sua cidade"
              className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500" />
          </div>

          <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-3">
            <span className="text-rose-400 font-bold text-xs flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Interesse
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Idade Mínima</label>
                <input type="number" inputMode="numeric" min={MIN_AGE} max={MAX_AGE} value={prefAgeMin}
                  onChange={(e) => setPrefAgeMin(sanitizeAgeInput(e.target.value))}
                  onBlur={(e) => setPrefAgeMin(clampAge(e.target.value))}
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Idade Máxima</label>
                <input type="number" inputMode="numeric" min={MIN_AGE} max={MAX_AGE} value={prefAgeMax}
                  onChange={(e) => setPrefAgeMax(sanitizeAgeInput(e.target.value))}
                  onBlur={(e) => setPrefAgeMax(clampAge(e.target.value))}
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1.5">Sexo de Interesse</label>
              <div className="flex flex-wrap gap-1.5">
                {[...GENDERS, 'Casal'].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => togglePrefGender(g)}
                    className={`py-1.5 px-2.5 text-[10px] font-bold rounded-lg border transition ${
                      prefGenders.includes(g)
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-[var(--c-surface-3)] border-[var(--c-border)] text-[var(--c-text-muted)] hover:border-[var(--c-border-strong)]'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1 flex items-center gap-1">
                <Navigation className="w-3 h-3 text-rose-400" /> A que distância você quer ver pessoas?
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_RADIUS_KM}
                  max={MAX_RADIUS_KM}
                  value={prefRadiusKm}
                  onChange={(e) => setPrefRadiusKm(sanitizeRadiusInput(e.target.value))}
                  onBlur={(e) => setPrefRadiusKm(clampRadius(e.target.value))}
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                />
                <span className="absolute right-3 top-1.5 text-[10px] text-[var(--c-text-muted)] font-semibold">km</span>
              </div>
              <p className="text-[10px] text-[var(--c-text-faint)] mt-1">
                Você verá pessoas de até {prefRadiusKm || 0}km de {location || 'sua cidade'}.
              </p>
            </div>
          </div>

          {/* About Me — optional, fillable any time after signup */}
          <div className="p-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-2xl space-y-3">
            <span className="text-[var(--c-accent)] font-bold text-xs flex items-center gap-1.5">
              <Info className="w-4 h-4" /> Sobre Você (opcional)
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Altura (cm)</label>
                <input type="number" inputMode="numeric" min={100} max={250} value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="Ex: 170"
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Peso aproximado (kg)</label>
                <input type="number" inputMode="numeric" min={30} max={250} value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="Ex: 70"
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Fuma?</label>
                <select value={smokes} onChange={(e) => setSmokes(e.target.value)}
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500">
                  <option value="">Prefiro não dizer</option>
                  {SMOKE_DRINK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Bebe?</label>
                <select value={drinks} onChange={(e) => setDrinks(e.target.value)}
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500">
                  <option value="">Prefiro não dizer</option>
                  {SMOKE_DRINK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Orientação sexual</label>
                <select value={sexualOrientation} onChange={(e) => setSexualOrientation(e.target.value)}
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500">
                  <option value="">Prefiro não dizer</option>
                  {SEXUAL_ORIENTATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Estado civil</label>
                <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)}
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500">
                  <option value="">Prefiro não dizer</option>
                  {MARITAL_STATUSES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Change Password — independent of the profile-info save above */}
          <div className="p-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-2xl space-y-3">
            <span className="text-[var(--c-accent)] font-bold text-xs flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" /> Alterar Senha
            </span>

            <div className="grid grid-cols-1 gap-2">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Senha atual"
                autoComplete="current-password"
                className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha (mín. 6 caracteres)"
                autoComplete="new-password"
                className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar nova senha"
                autoComplete="new-password"
                className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
              />
            </div>

            {passwordMsg && (
              <p className={`text-[11px] font-medium flex items-center gap-1 ${passwordMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {passwordMsg.type === 'success' && <Check className="w-3.5 h-3.5" />}
                {passwordMsg.text}
              </p>
            )}

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="w-full py-2.5 bg-[var(--c-overlay-10)] hover:bg-[var(--c-overlay-20)] text-[var(--c-text)] font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {changingPassword ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>

          {/* Danger Zone — permanent account deletion */}
          <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-2xl space-y-2.5">
            <span className="text-red-400 font-bold text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Excluir Conta
            </span>
            <p className="text-[10px] text-[var(--c-text-muted)] leading-relaxed">
              Isso apaga permanentemente seu perfil, publicações, comentários e conversas. Essa ação não pode ser desfeita.
            </p>

            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => { setConfirmingDelete(true); setDeleteError(''); setDeleteConfirmText(''); }}
                className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-xs rounded-xl transition"
              >
                Excluir minha conta
              </button>
            ) : (
              <div className="space-y-2">
                <label className="block text-[10px] text-red-300">
                  Digite <span className="font-mono font-bold">EXCLUIR</span> para confirmar:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="EXCLUIR"
                  className="w-full bg-[var(--c-surface-3)] border border-red-500/40 rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-red-500"
                />
                {deleteError && <p className="text-[11px] text-red-400 font-medium">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 py-2 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] text-[var(--c-text)] font-bold text-xs rounded-xl border border-[var(--c-border)] transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'EXCLUIR' || deletingAccount}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    {deletingAccount ? 'Excluindo...' : 'Confirmar exclusão'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[var(--c-overlay-5)] hover:bg-[var(--c-overlay-10)] text-[var(--c-text)] font-bold text-xs rounded-xl border border-[var(--c-border)] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
