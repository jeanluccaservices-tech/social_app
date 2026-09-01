// Handles "forgot password" requests. Rate-limited two ways: a general
// per-IP throttle against mass e-mail scanning, and the actual business
// rule — at most 3 recovery e-mails per e-mail address per 24h — so a
// single account can't be email-bombed via this endpoint. Before any of
// that, checks email_exists() (0029) and short-circuits with no e-mail
// sent and no per-e-mail rate-limit hit recorded if the address has no
// account — this deliberately reveals account existence (the app owner's
// choice: skip the mail entirely rather than send a "no account" e-mail).
//
// On success, calls supabase.auth.resetPasswordForEmail(), which triggers
// GoTrue's own recovery flow. That e-mail is delivered through the same
// Resend "send-email" Auth Hook already used for signup codes (see its
// 'recovery' case) — nothing to change there.
//
// No JWT verification (deployed with --no-verify-jwt): the person isn't
// logged in yet when asking for a reset.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkRateLimit, clientIdentity } from '../_shared/rateLimit.ts';

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

  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== 'string') {
    return jsonResponse({ error: 'Informe um e-mail válido.' }, 400);
  }
  const normalizedEmail = email.trim().toLowerCase();

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
  );

  const ipOk = await checkRateLimit(supabaseAdmin, `request-password-reset:${clientIdentity(req)}`, 8, 3600);
  if (!ipOk) {
    return jsonResponse({ error: 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.' }, 429);
  }

  const { data: exists, error: existsError } = await supabaseAdmin.rpc('email_exists', { check_email: normalizedEmail });
  if (existsError) {
    console.error('email_exists check failed', existsError);
    return jsonResponse({ error: 'Não foi possível processar o pedido. Tente novamente.' }, 500);
  }
  if (!exists) {
    return jsonResponse({ error: 'Não existe uma conta com esse e-mail.' }, 404);
  }

  const emailOk = await checkRateLimit(supabaseAdmin, `pwreset-email:${normalizedEmail}`, 3, 86400);
  if (!emailOk) {
    return jsonResponse(
      { error: 'Você atingiu o limite de 3 e-mails de recuperação por dia. Tente novamente mais tarde.' },
      429
    );
  }

  // Uses the anon key deliberately — resetPasswordForEmail is a public
  // GoTrue endpoint and doesn't need (or accept) the service role.
  const supabaseAnon = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_ANON_KEY') as string
  );
  const { error } = await supabaseAnon.auth.resetPasswordForEmail(normalizedEmail);
  if (error) {
    // Don't leak whether the e-mail has an account — log it and still
    // respond with the same generic success body below.
    console.error('resetPasswordForEmail failed', error);
  }

  return jsonResponse({ ok: true }, 200);
});
