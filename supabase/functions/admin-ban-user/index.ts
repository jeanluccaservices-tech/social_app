// Bans a user's account. The ban itself is enforced by Supabase Auth
// (auth.users.banned_until via the Admin API, which is what actually
// rejects login/token refresh for that account) — only the service role
// can call that API, hence this function. `profiles.banned_until` is then
// updated to mirror it, purely so the client can display/filter banned
// accounts without another service-role call.
//
// Deployed WITH JWT verification: any logged-in user can call this, but
// is_admin() (checked here, server-side, via the caller's own token) is
// what actually gates it — never trust a hidden UI tab alone.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Supabase's ban_duration accepts strings like "24h", "720h" — there's no
// literal "forever", so a permanent ban just uses a very long duration.
const PERMANENT_BAN_DURATION = '876000h'; // 100 years

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  const authedClient = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_ANON_KEY') as string,
    { global: { headers: { Authorization: authHeader ?? '' } } }
  );

  const {
    data: { user },
  } = await authedClient.auth.getUser();

  if (!user) {
    return jsonResponse({ error: 'Não autenticado.' }, 401);
  }

  const { data: isAdmin } = await authedClient.rpc('is_admin');
  if (!isAdmin) {
    return jsonResponse({ error: 'Acesso restrito a administradores.' }, 403);
  }

  const { target_user_id: targetUserId, duration_hours: durationHours } = await req.json().catch(() => ({}));
  if (!targetUserId) {
    return jsonResponse({ error: 'target_user_id é obrigatório.' }, 400);
  }
  if (targetUserId === user.id) {
    return jsonResponse({ error: 'Você não pode banir a própria conta.' }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
  );

  // Never lets one admin lock another admin out — banning/unbanning an
  // admin account has to go through revoking admin access first.
  const { data: targetIsAdmin } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (targetIsAdmin) {
    return jsonResponse({ error: 'Não é possível banir outro administrador.' }, 400);
  }

  const banDuration = durationHours ? `${Math.max(1, Math.floor(Number(durationHours)))}h` : PERMANENT_BAN_DURATION;

  const { data: banResult, error: banError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    ban_duration: banDuration,
  });
  if (banError) {
    console.error(banError);
    return jsonResponse({ error: 'Não foi possível banir o usuário.' }, 500);
  }

  await supabaseAdmin
    .from('profiles')
    .update({ banned_until: banResult.user.banned_until ?? null })
    .eq('id', targetUserId);

  return jsonResponse({ ok: true, banned_until: banResult.user.banned_until ?? null }, 200);
});
