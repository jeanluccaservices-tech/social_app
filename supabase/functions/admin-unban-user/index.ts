// Lifts a ban — mirror of admin-ban-user. See that function's comments for
// why this needs the service role and how banned_until is enforced.
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

  const { target_user_id: targetUserId } = await req.json().catch(() => ({}));
  if (!targetUserId) {
    return jsonResponse({ error: 'target_user_id é obrigatório.' }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
  );

  const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    ban_duration: 'none',
  });
  if (unbanError) {
    console.error(unbanError);
    return jsonResponse({ error: 'Não foi possível desbanir o usuário.' }, 500);
  }

  await supabaseAdmin.from('profiles').update({ banned_until: null }).eq('id', targetUserId);

  return jsonResponse({ ok: true }, 200);
});
