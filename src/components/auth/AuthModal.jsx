import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { stripEmojis } from '../../utils/text';
import { Heart, Users, X, Lock, Mail, User, Target, MapPin, Loader2, MailCheck, ShieldCheck, KeyRound, Cake, Navigation } from 'lucide-react';
import { GENDERS, MIN_AGE, MAX_AGE, sanitizeAgeInput, clampAge, MIN_BIRTH_DATE, MAX_BIRTH_DATE, calculateAge } from '../../lib/constants';
import { CitySelect } from '../common/CitySelect';
import { SupportButton } from '../common/SupportButton';

export const AuthModal = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, login, register, verifySignup, resendVerification } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'verify'
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Post-signup e-mail code verification (sent via Resend)
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // The modal instance stays mounted for the app's whole lifetime (it just
  // renders null while closed), so `mode` would otherwise still say
  // 'verify' the next time it's opened after a past signup — reset to a
  // clean login screen on every fresh open.
  useEffect(() => {
    if (isAuthModalOpen) {
      setMode('login');
      setErrorMsg('');
      setInfoMsg('');
    }
  }, [isAuthModalOpen]);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regGender, setRegGender] = useState('Feminino'); // 'Masculino' | 'Feminino' | 'Casal'
  const [regAgeConsent, setRegAgeConsent] = useState(false);
  const [regLocation, setRegLocation] = useState('');

  // Matching preferences: who this profile wants to see/be shown to
  const [prefAgeMin, setPrefAgeMin] = useState('21');
  const [prefAgeMax, setPrefAgeMax] = useState('40');
  const [prefGenders, setPrefGenders] = useState(['Feminino']);
  const [prefRadiusKm, setPrefRadiusKm] = useState('50');

  const togglePrefGender = (gender) => {
    setPrefGenders(prev =>
      prev.includes(gender) ? prev.filter(g => g !== gender) : [...prev, gender]
    );
  };

  // Couple specific fields
  const [p1Name, setP1Name] = useState('');
  const [p1Age, setP1Age] = useState('28');
  const [p1Gender, setP1Gender] = useState('Masculino'); // 'Masculino' | 'Feminino'

  const [p2Name, setP2Name] = useState('');
  const [p2Age, setP2Age] = useState('26');
  const [p2Gender, setP2Gender] = useState('Feminino'); // 'Masculino' | 'Feminino'

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    if (!loginIdentifier || !loginPassword) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }
    setIsSubmitting(true);
    const res = await login(loginIdentifier, loginPassword);
    setIsSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!regEmail || !regUsername || !regPassword) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (regGender === 'Casal') {
      if (!p1Name || !p2Name) {
        setErrorMsg('Para o cadastro de Casal, preencha os nomes de ambos os integrantes.');
        return;
      }
      if (!p1Age || Number(p1Age) < 18 || Number(p1Age) > 100 || !p2Age || Number(p2Age) < 18 || Number(p2Age) > 100) {
        setErrorMsg('Ambos os integrantes do casal precisam ter entre 18 e 100 anos.');
        return;
      }
    } else {
      if (!regName) {
        setErrorMsg('Por favor, preencha o seu Nome Completo.');
        return;
      }
      if (!regBirthDate) {
        setErrorMsg('Informe sua data de nascimento.');
        return;
      }
      const age = calculateAge(regBirthDate);
      if (age === null || age < 18 || age > 100) {
        setErrorMsg('Você precisa ter entre 18 e 100 anos para se cadastrar no LoveVibe.');
        return;
      }
    }

    if (!regAgeConsent) {
      setErrorMsg('Confirme que você é maior de 18 anos e concorda com os Termos de Uso para continuar.');
      return;
    }

    const payload = {
      name: regGender === 'Casal' ? `${p1Name} & ${p2Name}` : regName,
      email: regEmail,
      phone: regPhone,
      username: regUsername,
      password: regPassword,
      birthDate: regBirthDate,
      gender: regGender,
      location: regLocation,
      preferences: {
        ageMin: Number(prefAgeMin) || 18,
        ageMax: Number(prefAgeMax) || 99,
        genders: prefGenders,
        radiusKm: Number(prefRadiusKm) || 50
      },
      partner1: regGender === 'Casal' ? { name: p1Name, age: p1Age, gender: p1Gender } : null,
      partner2: regGender === 'Casal' ? { name: p2Name, age: p2Age, gender: p2Gender } : null,
      ageConsent: regAgeConsent
    };

    setIsSubmitting(true);
    const res = await register(payload);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message);
    } else if (res.needsConfirmation) {
      setPendingVerifyEmail(regEmail);
      setVerifyCode('');
      setMode('verify');
      setInfoMsg('Cadastro criado! Enviamos um código de verificação para o seu e-mail.');
      setResendCooldown(30);
    } else {
      setInfoMsg('Cadastro criado com sucesso!');
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (verifyCode.trim().length < 6) {
      setErrorMsg('Informe o código de 6 dígitos enviado por e-mail.');
      return;
    }

    setIsSubmitting(true);
    const res = await verifySignup(pendingVerifyEmail, verifyCode.trim());
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setErrorMsg('');
    setInfoMsg('');
    setIsSubmitting(true);
    const res = await resendVerification(pendingVerifyEmail);
    setIsSubmitting(false);

    if (res.success) {
      setInfoMsg('Novo código enviado! Verifique seu e-mail.');
      setResendCooldown(30);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[var(--c-surface)] border border-rose-500/30 rounded-3xl shadow-2xl shadow-rose-950/50 overflow-hidden my-8">
        
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/30 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={() => setIsAuthModalOpen(false)}
          className="absolute top-4 right-4 text-[var(--c-text-muted)] hover:text-[var(--c-text)] p-2 rounded-full hover:bg-[var(--c-overlay-10)] transition"
        >
          <X className="w-5 h-5" />
        </button>

        <SupportButton className="absolute top-5 left-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-rose-400 transition" />

        {/* Modal Header */}
        <div className="pt-8 pb-4 px-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 shadow-lg shadow-rose-600/40 mb-3">
            <Heart className="w-6 h-6 text-[var(--c-text)] fill-current animate-pulse" />
          </div>
          <h2 className="font-display text-2xl font-semibold italic text-[var(--c-text)] tracking-tight">LoveVibe</h2>
          <p className="text-sm text-[var(--c-accent)] mt-1">Conexões autênticas para solteiros e casais</p>

          {/* Mode Switcher Tabs */}
          {mode !== 'verify' && (
            <div className="flex bg-[var(--c-surface-3)] p-1 rounded-2xl border border-[var(--c-border)] mt-6">
              <button
                onClick={() => { setMode('login'); setErrorMsg(''); setInfoMsg(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${
                  mode === 'login'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => { setMode('register'); setErrorMsg(''); setInfoMsg(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${
                  mode === 'register'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
                }`}
              >
                Criar Conta
              </button>
            </div>
          )}
        </div>

        {/* Error / Info Alert */}
        {errorMsg && (
          <div className="mx-6 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="mx-6 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs text-center font-medium flex items-center justify-center gap-1.5">
            <MailCheck className="w-3.5 h-3.5 flex-shrink-0" /> {infoMsg}
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 pt-2">
          {mode === 'verify' ? (
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="flex flex-col items-center text-center gap-2 pb-1">
                <div className="w-11 h-11 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-rose-400" />
                </div>
                <p className="text-xs text-[var(--c-text-secondary)]">
                  Enviamos um código de 6 dígitos para{' '}
                  <span className="font-semibold text-[var(--c-text)]">{pendingVerifyEmail}</span>.
                  Digite-o abaixo para confirmar sua conta.
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center tracking-[0.6em] text-xl font-bold bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-3 px-4 text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500 transition"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Verificando...' : 'Confirmar Código'}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isSubmitting}
                className="w-full text-xs font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-50 disabled:pointer-events-none transition"
              >
                {resendCooldown > 0 ? `Reenviar código em ${resendCooldown}s` : 'Reenviar código'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMsg(''); setInfoMsg(''); }}
                className="w-full text-[11px] text-[var(--c-text-muted)] hover:text-[var(--c-text)] transition"
              >
                Voltar para o login
              </button>
            </form>
          ) : mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-[var(--c-text-muted)]" />
                  <input
                    type="email"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-[var(--c-text-muted)]" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Entrando...' : 'Entrar na Conta'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Gender Selector */}
              <div>
                <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1.5">Perfil para:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    ...GENDERS.map(g => ({ key: g, label: g, icon: User })),
                    { key: 'Casal', label: 'Casal ❤️❤️', icon: Users }
                  ].map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setRegGender(item.key)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                        regGender === item.key
                          ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/30'
                          : 'bg-[var(--c-surface-3)] border-[var(--c-border)] text-[var(--c-text-secondary)] hover:border-[var(--c-border-strong)]'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Couple vs Single Registration Fields */}
              {regGender === 'Casal' ? (
                <div className="space-y-3 p-3 bg-rose-950/20 border border-rose-500/30 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-rose-400 font-bold text-xs flex items-center gap-1">
                      <Users className="w-4 h-4" /> Dados e Sexo de Ambos os Integrantes:
                    </span>
                  </div>

                  {/* Preset Quick Sex Combination Shortcuts */}
                  <div className="flex gap-1.5 text-[10px]">
                    <span className="text-[var(--c-text-muted)] font-semibold my-auto">Atalho:</span>
                    <button
                      type="button"
                      onClick={() => { setP1Gender('Masculino'); setP2Gender('Feminino'); }}
                      className={`px-2 py-1 rounded-lg border font-bold transition ${
                        p1Gender === 'Masculino' && p2Gender === 'Feminino'
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-[var(--c-overlay-5)] text-[var(--c-text-secondary)] border-[var(--c-border)]'
                      }`}
                    >
                      Homem & Mulher
                    </button>
                    <button
                      type="button"
                      onClick={() => { setP1Gender('Masculino'); setP2Gender('Masculino'); }}
                      className={`px-2 py-1 rounded-lg border font-bold transition ${
                        p1Gender === 'Masculino' && p2Gender === 'Masculino'
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-[var(--c-overlay-5)] text-[var(--c-text-secondary)] border-[var(--c-border)]'
                      }`}
                    >
                      Homem & Homem
                    </button>
                    <button
                      type="button"
                      onClick={() => { setP1Gender('Feminino'); setP2Gender('Feminino'); }}
                      className={`px-2 py-1 rounded-lg border font-bold transition ${
                        p1Gender === 'Feminino' && p2Gender === 'Feminino'
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-[var(--c-overlay-5)] text-[var(--c-text-secondary)] border-[var(--c-border)]'
                      }`}
                    >
                      Mulher & Mulher
                    </button>
                  </div>

                  {/* Partner 1 Details */}
                  <div className="bg-[var(--c-surface-3)] p-3 rounded-xl border border-[var(--c-border)] space-y-2">
                    <span className="text-[11px] font-bold text-[var(--c-accent)]">Integrante 1:</span>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={p1Name}
                        onChange={e => setP1Name(stripEmojis(e.target.value))}
                        placeholder="Nome (Pessoa 1)"
                        className="col-span-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={MIN_AGE}
                        max={MAX_AGE}
                        value={p1Age}
                        onChange={e => setP1Age(sanitizeAgeInput(e.target.value))}
                        onBlur={e => setP1Age(clampAge(e.target.value))}
                        placeholder="Idade"
                        className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                      />
                      <select
                        value={p1Gender}
                        onChange={e => setP1Gender(e.target.value)}
                        className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                      >
                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Partner 2 Details */}
                  <div className="bg-[var(--c-surface-3)] p-3 rounded-xl border border-[var(--c-border)] space-y-2">
                    <span className="text-[11px] font-bold text-[var(--c-accent)]">Integrante 2:</span>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={p2Name}
                        onChange={e => setP2Name(stripEmojis(e.target.value))}
                        placeholder="Nome (Pessoa 2)"
                        className="col-span-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={MIN_AGE}
                        max={MAX_AGE}
                        value={p2Age}
                        onChange={e => setP2Age(sanitizeAgeInput(e.target.value))}
                        onBlur={e => setP2Age(clampAge(e.target.value))}
                        placeholder="Idade"
                        className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                      />
                      <select
                        value={p2Gender}
                        onChange={e => setP2Gender(e.target.value)}
                        className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg py-1.5 px-2 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                      >
                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(stripEmojis(e.target.value))}
                      placeholder="Seu Nome"
                      className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1 flex items-center gap-1">
                      <Cake className="w-3.5 h-3.5 text-rose-400" /> Nascimento
                    </label>
                    <input
                      type="date"
                      min={MIN_BIRTH_DATE}
                      max={MAX_BIRTH_DATE}
                      value={regBirthDate}
                      onChange={(e) => setRegBirthDate(e.target.value)}
                      className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">E-mail *</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">Telefone (opcional)</label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+55 11 9..."
                    className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">Nome de Usuário *</label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="ex: @lucas"
                    className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1">Senha *</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Location Field */}
              <div>
                <label className="block text-xs font-semibold text-[var(--c-text-secondary)] mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" /> Sua Localização
                </label>
                <CitySelect
                  value={regLocation}
                  onChange={(e) => setRegLocation(e.target.value)}
                  placeholder="Selecione sua cidade"
                  className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl py-2 px-3 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Matching Preferences */}
              <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-3">
                <span className="text-rose-400 font-bold text-xs flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Interesse (quem você quer conhecer)
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Idade Mínima</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={MIN_AGE}
                      max={MAX_AGE}
                      value={prefAgeMin}
                      onChange={(e) => setPrefAgeMin(sanitizeAgeInput(e.target.value))}
                      onBlur={(e) => setPrefAgeMin(clampAge(e.target.value))}
                      className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--c-text-muted)] mb-1">Idade Máxima</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={MIN_AGE}
                      max={MAX_AGE}
                      value={prefAgeMax}
                      onChange={(e) => setPrefAgeMax(sanitizeAgeInput(e.target.value))}
                      onBlur={(e) => setPrefAgeMax(clampAge(e.target.value))}
                      className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                    />
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
                      min={1}
                      max={500}
                      value={prefRadiusKm}
                      onChange={(e) => setPrefRadiusKm(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      className="w-full bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--c-text)] focus:outline-none focus:border-rose-500"
                    />
                    <span className="absolute right-3 top-1.5 text-[10px] text-[var(--c-text-muted)] font-semibold">km</span>
                  </div>
                  <p className="text-[10px] text-[var(--c-text-faint)] mt-1">
                    Você verá pessoas de até {prefRadiusKm || 0}km de {regLocation || 'sua cidade'}.
                  </p>
                </div>
              </div>

              {/* Age & responsibility consent — required */}
              <label className="flex items-start gap-2 cursor-pointer p-2.5 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-xl">
                <input
                  type="checkbox"
                  checked={regAgeConsent}
                  onChange={(e) => setRegAgeConsent(e.target.checked)}
                  className="mt-0.5 rounded text-rose-500 focus:ring-rose-500 bg-[var(--c-surface)] border-[var(--c-border-med)]"
                />
                <span className="text-[11px] text-[var(--c-text-secondary)] leading-snug flex gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Declaro que tenho <strong className="text-[var(--c-text)]">18 anos ou mais</strong> e
                    que todas as informações fornecidas neste cadastro são verdadeiras. Sou o único
                    responsável pela veracidade dos meus dados e pelo uso da minha conta, conforme os
                    Termos de Uso.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting || !regAgeConsent}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Cadastrando...' : 'Cadastrar Perfil'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
