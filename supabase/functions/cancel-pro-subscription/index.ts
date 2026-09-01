// Lets a logged-in user cancel their most recent PRO payment within 7 days
// of paying and get it refunded in full via Stripe (direito de
// arrependimento, CDC art. 49 — mandatory for purchases made outside a
// physical establishment, which includes this app's Checkout).
//
// Deployed WITH JWT verification, same as stripe-checkout. There is no real
// Stripe Subscription to cancel here (PRO is a one-off payment that grants
// 1 month, see stripe-checkout's comment) — "cancelling" means refunding the
// latest un-refunded approved payment and rolling pro_expires_at back by
// the month that payment granted.
//
// Required secrets: STRIPE_SECRET_KEY (same one stripe-checkout uses),
// RESEND_API_KEY (same one report-post/send-email use, for the internal
// refund notification e-mail).
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';
import { Resend } from 'npm:resend';
import { checkRateLimit, clientIdentity } from '../_shared/rateLimit.ts';

const WITHDRAWAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FROM_ADDRESS = 'LoveVibe <noreply@lovevibe.com.br>';
const REFUND_TO_EMAIL = 'reembolso@lovevibe.com.br';

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

  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secretKey || secretKey.startsWith('REPLACE_')) {
    return jsonResponse({ error: 'Cancelamento ainda não configurado. Tente novamente mais tarde.' }, 503);
  }

  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_ANON_KEY') as string,
    { global: { headers: { Authorization: authHeader ?? '' } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ error: 'Não autenticado.' }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
  );

  const withinLimit = await checkRateLimit(
    supabaseAdmin,
    `cancel-pro-subscription:${clientIdentity(req, user.id)}`,
    5,
    600
  );
  if (!withinLimit) {
    return jsonResponse({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, 429);
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payment_transactions')
    .select('id, provider_payment_id, created_at, amount_cents')
    .eq('user_id', user.id)
    .eq('provider', 'stripe')
    .eq('status', 'approved')
    .is('refunded_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError || !payment) {
    return jsonResponse({ error: 'Nenhum pagamento elegível para cancelamento foi encontrado.' }, 404);
  }

  const paidAt = new Date(payment.created_at).getTime();
  if (Date.now() - paidAt > WITHDRAWAL_WINDOW_MS) {
    return jsonResponse(
      { error: 'O prazo de 7 dias após o pagamento para cancelar com reembolso já passou.' },
      400
    );
  }

  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });

  try {
    await stripe.refunds.create({ payment_intent: payment.provider_payment_id });
  } catch (error) {
    console.error(error);
    const message = error instanceof Stripe.errors.StripeError ? error.message : null;
    return jsonResponse({ error: message || 'Não foi possível processar o reembolso. Tente novamente.' }, 500);
  }

  await supabaseAdmin
    .from('payment_transactions')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', payment.id);

  // Roll pro_expires_at back by the 1 month this specific payment granted,
  // rather than wiping it outright — if a second payment was already
  // stacked on top (see stripe-webhook), that period is untouched.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('pro_expires_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.pro_expires_at) {
    const rolledBack = new Date(profile.pro_expires_at);
    rolledBack.setMonth(rolledBack.getMonth() - 1);
    const newExpiry = rolledBack > new Date() ? rolledBack.toISOString() : null;
    await supabaseAdmin.from('profiles').update({ pro_expires_at: newExpiry }).eq('id', user.id);
  }

  // Internal notification only — the refund itself already happened above,
  // so a Resend hiccup here shouldn't turn into a "failed" response for the
  // user who just cancelled.
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('name, username')
        .eq('id', user.id)
        .maybeSingle();

      const resend = new Resend(resendApiKey);
      const amount = payment.amount_cents != null ? `R$ ${(payment.amount_cents / 100).toFixed(2).replace('.', ',')}` : '—';

      await resend.emails.send({
        from: FROM_ADDRESS,
        to: [REFUND_TO_EMAIL],
        subject: `Reembolso PRÓ processado — ${amount}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
            <h2 style="color:#e11d48;">Cancelamento e reembolso da assinatura PRÓ</h2>
            <table style="width:100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding:6px 0; color:#666;">Usuário</td><td style="padding:6px 0;">${userProfile?.name || 'Usuário'} (@${userProfile?.username || '—'}) — ${user.email || '—'}</td></tr>
              <tr><td style="padding:6px 0; color:#666;">Valor reembolsado</td><td style="padding:6px 0; font-weight:bold;">${amount}</td></tr>
              <tr><td style="padding:6px 0; color:#666;">Pagamento original</td><td style="padding:6px 0;">${new Date(payment.created_at).toLocaleString('pt-BR')}</td></tr>
              <tr><td style="padding:6px 0; color:#666;">ID do pagamento (Stripe)</td><td style="padding:6px 0; font-family: monospace;">${payment.provider_payment_id}</td></tr>
              <tr><td style="padding:6px 0; color:#666;">ID do usuário</td><td style="padding:6px 0; font-family: monospace;">${user.id}</td></tr>
            </table>
            <p style="margin-top:16px; color:#666; font-size:12px;">Cancelamento dentro do prazo de 7 dias (direito de arrependimento, CDC art. 49). O acesso PRÓ já foi revogado automaticamente.</p>
          </div>`,
      });
    } else {
      console.warn('cancel-pro-subscription: RESEND_API_KEY not set, skipping notification e-mail');
    }
  } catch (err) {
    console.error('cancel-pro-subscription: notification e-mail failed', err);
  }

  return jsonResponse({ success: true }, 200);
});
