import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatJoinedDate } from '../utils/time';
import { calculateAge } from '../lib/constants';

const AuthContext = createContext();

// Partner age is never stored directly — like the single-profile age, it's
// derived from a stored birth date so it can't go stale.
const mapPartner = (p) => (p ? { ...p, age: calculateAge(p.birthDate) } : null);

const mapProfile = (row) => {
  if (!row) return null;
  const partner1 = mapPartner(row.partner1);
  const partner2 = mapPartner(row.partner2);
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    phone: row.phone || '',
    birthDate: row.birth_date || '',
    age: row.is_couple ? `${partner1?.age ?? '?'} & ${partner2?.age ?? '?'}` : calculateAge(row.birth_date),
    gender: row.gender,
    isCouple: row.is_couple,
    // PRO is never a stored flag — it's always "is the paid access still
    // within its 1-month window", so it can't go stale.
    isPro: !!row.pro_expires_at && new Date(row.pro_expires_at) > new Date(),
    proExpiresAt: row.pro_expires_at || null,
    bannedUntil: row.banned_until || null,
    // "Online" is derived from a heartbeat timestamp (see the interval
    // below) rather than a real presence system — a couple of minutes of
    // slack covers the polling/heartbeat intervals without flickering.
    isOnline: !!row.last_seen_at && (Date.now() - new Date(row.last_seen_at).getTime()) < 2 * 60 * 1000,
    avatar: row.avatar_url || '',
    cover: row.cover_url || '',
    bio: row.bio || '',
    location: row.location || '',
    preferences: {
      ageMin: row.pref_age_min,
      ageMax: row.pref_age_max,
      genders: row.pref_genders || [],
      radiusKm: row.pref_radius_km ?? 50
    },
    partner1,
    partner2,
    joinedDate: formatJoinedDate(row.created_at),
    createdAtRaw: row.created_at,
    about: {
      heightCm: row.height_cm ?? null,
      weightKg: row.weight_kg ?? null,
      smokes: row.smokes || '',
      drinks: row.drinks || '',
      sexualOrientation: row.sexual_orientation || '',
      maritalStatus: row.marital_status || ''
    }
  };
};

const mapAuthError = (error) => {
  const msg = error?.message || '';
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('Unable to validate email address')) return 'E-mail inválido.';
  if (msg.includes('Token has expired or is invalid')) return 'Código inválido ou expirado. Solicite um novo código.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail com o código enviado antes de entrar.';
  if (msg.includes('Database error saving new user')) {
    return 'Não foi possível concluir o cadastro. Tente novamente com outro nome de usuário.';
  }
  return msg || 'Ocorreu um erro. Tente novamente.';
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [banNotice, setBanNotice] = useState('');

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data || []).map(mapProfile));
  }, []);

  const fetchCurrentProfile = useCallback(async (userId) => {
    if (!userId) {
      setCurrentUser(null);
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

    // The real ban enforcement is server-side (Supabase Auth rejects
    // login/refresh for a banned account, see admin-ban-user) — this just
    // closes the gap for a session whose access token is still technically
    // valid, signing them out as soon as the app notices instead of
    // waiting for that token to expire on its own.
    if (data?.banned_until && new Date(data.banned_until) > new Date()) {
      setCurrentUser(null);
      setIsAdmin(false);
      setBanNotice('Sua conta foi suspensa. Se achar que isso é um engano, entre em contato com o suporte.');
      await supabase.auth.signOut();
      return;
    }

    setCurrentUser(mapProfile(data));
    const { data: adminData } = await supabase.rpc('is_admin');
    setIsAdmin(!!adminData);
  }, []);

  // Re-reads the logged-in user's own row — used after an action whose
  // effect lands via a server-side process (e.g. a Pix payment approved by
  // the stripe-webhook Edge Function) rather than from the client's own write.
  const refreshCurrentUser = useCallback(async () => {
    if (!session) return;
    await fetchCurrentProfile(session.user.id);
  }, [session, fetchCurrentProfile]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active) return;
        setSession(session);
        await Promise.all([fetchUsers(), fetchCurrentProfile(session?.user?.id)]);
      } catch (error) {
        // A cold first load can hit a transient network hiccup (DNS/TLS not
        // warmed up yet) here. Without this catch, the rejection was
        // unhandled and authLoading never cleared, freezing the app on the
        // splash screen until a manual refresh retried on a warm connection.
        console.error('Failed to load initial session', error);
      } finally {
        if (active) setAuthLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      await fetchCurrentProfile(session?.user?.id);
      if (session?.user?.id) fetchUsers();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchUsers, fetchCurrentProfile]);

  // Heartbeat for online/offline status — updates the logged-in user's own
  // last_seen_at every minute while the app is open. No presence system:
  // just a timestamp other clients compare against a 2-minute window (see
  // mapProfile above).
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    const beat = () => supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId);
    beat();
    const interval = setInterval(beat, 60000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // Light polling so other users' last_seen_at (and everything else about
  // them) refreshes periodically — same pattern SocialContext already uses
  // for contacts/notifications instead of a realtime subscription.
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(fetchUsers, 60000);
    return () => clearInterval(interval);
  }, [session, fetchUsers]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: mapAuthError(error) };
    setIsAuthModalOpen(false);
    return { success: true };
  };

  const register = async (data) => {
    if (!data.ageConsent) {
      return { success: false, message: 'É necessário confirmar que você é maior de 18 anos e concordar com os Termos de Uso.' };
    }

    // Strip any leading "@" the user typed — the app always prefixes the
    // stored username with "@" when displaying it, so a stored "@" would
    // show up doubled ("@@username") everywhere. Any other "@" (not at the
    // start) becomes "_" instead, same as spaces. Also normalize to
    // lowercase so usernames stay consistent and URL/mention-safe
    // regardless of what the user typed.
    const username = data.username.trim().replace(/^@+/, '').replace(/@/g, '_').replace(/\s+/g, '_').toLowerCase();

    const isCouple = data.gender === 'Casal';

    if (isCouple) {
      const p1Age = calculateAge(data.partner1?.birthDate);
      const p2Age = calculateAge(data.partner2?.birthDate);
      if (p1Age === null || p1Age < 18 || p1Age > 100 || p2Age === null || p2Age < 18 || p2Age > 100) {
        return { success: false, message: 'Ambos os integrantes do casal precisam ter entre 18 e 100 anos.' };
      }
    } else {
      const age = calculateAge(data.birthDate);
      if (age === null || age < 18 || age > 100) {
        return { success: false, message: 'Você precisa ter entre 18 e 100 anos para se cadastrar no LoveVibe.' };
      }
    }

    // profiles is only readable while logged in (0006), so this can't be a
    // direct SELECT — a person registering has no session yet. RPC exposes
    // just a yes/no instead.
    const { data: usernameTaken } = await supabase.rpc('is_username_taken', { check_username: username });
    if (usernameTaken) {
      return { success: false, message: 'Nome de usuário já está em uso.' };
    }

    const metadata = {
      username,
      name: isCouple ? `${data.partner1?.name} & ${data.partner2?.name}` : data.name,
      phone: data.phone || '',
      birth_date: isCouple ? null : data.birthDate || null,
      gender: isCouple ? 'Casal' : data.gender,
      is_couple: isCouple,
      avatar_url: data.avatar || null,
      cover_url: null,
      bio: data.bio || (isCouple ? 'Casal cadastrado no LoveVibe! ✨' : 'Novo integrante no LoveVibe! ✨'),
      location: data.location || '',
      pref_age_min: Number(data.preferences?.ageMin) || 18,
      pref_age_max: Number(data.preferences?.ageMax) || 99,
      pref_genders: data.preferences?.genders && data.preferences.genders.length > 0
        ? data.preferences.genders
        : ['Masculino', 'Feminino', 'Casal'],
      pref_radius_km: Number(data.preferences?.radiusKm) || 50,
      partner1: isCouple ? data.partner1 : null,
      partner2: isCouple ? data.partner2 : null,
      age_confirmed: true
    };

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: metadata }
    });

    if (error) return { success: false, message: mapAuthError(error) };

    const needsConfirmation = !signUpData.session;
    if (!needsConfirmation) setIsAuthModalOpen(false);
    return { success: true, needsConfirmation };
  };

  // Confirms the 6-digit code sent by e-mail (delivered via the Resend send-email
  // hook) and completes the signup, establishing a session on success.
  const verifySignup = async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) return { success: false, message: mapAuthError(error) };
    setIsAuthModalOpen(false);
    return { success: true };
  };

  const resendVerification = async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return { success: false, message: mapAuthError(error) };
    return { success: true };
  };

  // Triggers a password-recovery e-mail through the request-password-reset
  // Edge Function, which enforces the real limit (3 e-mails/24h per
  // address, plus a per-IP throttle) and checks the e-mail actually has an
  // account first — the client can't be trusted to self-limit any of this.
  const requestPasswordReset = async (email) => {
    const { error } = await supabase.functions.invoke('request-password-reset', { body: { email } });
    if (error) {
      let message = 'Não foi possível enviar o e-mail de recuperação. Tente novamente.';
      try {
        const errBody = await error.context?.json();
        if (errBody?.error) message = errBody.error;
      } catch {
        // keep the generic message
      }
      return { success: false, message };
    }
    return { success: true };
  };

  // Confirms the 6-digit recovery code (delivered via the same Resend
  // send-email hook, 'recovery' case) and sets the new password.
  const confirmPasswordReset = async (email, token, newPassword) => {
    if (newPassword.length < 6) return { success: false, message: 'A senha deve ter pelo menos 6 caracteres.' };

    const { error: otpError } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    if (otpError) return { success: false, message: mapAuthError(otpError) };

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return { success: false, message: mapAuthError(updateError) };

    setIsAuthModalOpen(false);
    return { success: true };
  };

  const logout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
  };

  // Update any editable profile field (everything except username).
  const updateProfile = async (updates) => {
    if (!currentUser) return;

    // Gender is fixed at signup and can't be changed here — intentionally
    // not read from `updates` even if a caller passes it.
    const dbUpdates = {};
    if ('avatar' in updates) dbUpdates.avatar_url = updates.avatar;
    if ('cover' in updates) dbUpdates.cover_url = updates.cover;
    if ('name' in updates) dbUpdates.name = updates.name;
    if ('birthDate' in updates && !currentUser.isCouple) dbUpdates.birth_date = updates.birthDate || null;
    if ('bio' in updates) dbUpdates.bio = updates.bio;
    if ('location' in updates) dbUpdates.location = updates.location;
    // Partner genders are likewise fixed at signup — keep the existing
    // value no matter what the caller sends for it.
    if ('partner1' in updates) dbUpdates.partner1 = { ...updates.partner1, gender: currentUser.partner1?.gender };
    if ('partner2' in updates) dbUpdates.partner2 = { ...updates.partner2, gender: currentUser.partner2?.gender };
    if ('about' in updates) {
      dbUpdates.height_cm = updates.about.heightCm ? Number(updates.about.heightCm) : null;
      dbUpdates.weight_kg = updates.about.weightKg ? Number(updates.about.weightKg) : null;
      dbUpdates.smokes = updates.about.smokes || null;
      dbUpdates.drinks = updates.about.drinks || null;
      dbUpdates.sexual_orientation = updates.about.sexualOrientation || null;
      dbUpdates.marital_status = updates.about.maritalStatus || null;
    }
    if ('preferences' in updates) {
      dbUpdates.pref_age_min = Number(updates.preferences.ageMin) || 18;
      dbUpdates.pref_age_max = Number(updates.preferences.ageMax) || 99;
      dbUpdates.pref_genders = updates.preferences.genders || [];
      dbUpdates.pref_radius_km = Number(updates.preferences.radiusKm) || 50;
    }

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', currentUser.id);
    if (error) return { success: false, message: error.message };

    await fetchCurrentProfile(currentUser.id);
    fetchUsers();
    return { success: true };
  };

  // Re-authenticates with the current password before changing it — the
  // client SDK's updateUser() doesn't require this on its own since the
  // session is already valid, but skipping it would let anyone with an
  // unlocked device change the password with no proof of knowing it.
  const changePassword = async (currentPassword, newPassword) => {
    if (!session?.user?.email) return { success: false, message: 'Nenhuma conta ativa.' };
    if (newPassword.length < 6) return { success: false, message: 'A nova senha deve ter pelo menos 6 caracteres.' };

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword
    });
    if (verifyError) return { success: false, message: 'Senha atual incorreta.' };

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, message: mapAuthError(error) };
    return { success: true };
  };

  // Cancels the most recent PRO payment within its 7-day withdrawal window
  // (CDC art. 49) via the cancel-pro-subscription Edge Function, which
  // refunds it through Stripe and rolls pro_expires_at back accordingly.
  const cancelProSubscription = async () => {
    const { error } = await supabase.functions.invoke('cancel-pro-subscription');
    if (error) {
      let message = 'Não foi possível cancelar. Tente novamente.';
      try {
        const errBody = await error.context?.json();
        if (errBody?.error) message = errBody.error;
      } catch {
        // keep the generic message
      }
      return { success: false, message };
    }
    await refreshCurrentUser();
    return { success: true };
  };

  // Permanently deletes the account: archives the id/username into
  // deleted_accounts, then removes the auth user, which cascades through
  // every table with a profiles(id) FK (posts, comments, messages in both
  // directions, friendships, group rooms, notifications...).
  const deleteAccount = async () => {
    if (!currentUser) return { success: false, message: 'Nenhuma conta ativa.' };
    const { error } = await supabase.rpc('delete_own_account');
    if (error) return { success: false, message: 'Não foi possível excluir a conta. Tente novamente.' };
    await supabase.auth.signOut();
    setSession(null);
    setCurrentUser(null);
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      users,
      authLoading,
      session,
      login,
      register,
      verifySignup,
      resendVerification,
      requestPasswordReset,
      confirmPasswordReset,
      logout,
      loggingOut,
      refreshCurrentUser,
      updateProfile,
      changePassword,
      cancelProSubscription,
      deleteAccount,
      fetchUsers,
      isAuthModalOpen,
      setIsAuthModalOpen,
      isProModalOpen,
      setIsProModalOpen,
      isAdmin,
      banNotice,
      clearBanNotice: () => setBanNotice('')
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
