// Creates a Pix payment directly via Stripe's Payment Intents API (not
// Checkout Session — Pix needs its own dedicated flow so we can show the
// QR code / copy-paste code right here in the app instead of redirecting).
// PRO is activated by the stripe-webhook Edge Function once Stripe confirms
// the payment — this function only creates the charge and hands back what's
// needed to display it.
//
// Requires a logged-in user (deployed WITH JWT verification).
//
// Required secret (set with `supabase secrets set`):
//   STRIPE_SECRET_KEY  - same Secret key used by stripe-checkout
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';
import { checkRateLimit, clientIdentity } from '../_shared/rateLimit.ts';

const PRO_PRICE_BRL = 24.9;

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
    return jsonResponse({ error: 'Pagamentos ainda não configurados. Tente novamente mais tarde.' }, 503);
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
    `stripe-pix-payment:${clientIdentity(req, user.id)}`,
    5,
    600
  );
  if (!withinLimit) {
    return jsonResponse({ error: 'Muitas tentativas de pagamento. Aguarde alguns minutos e tente novamente.' }, 429);
  }

  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(PRO_PRICE_BRL * 100),
        currency: 'brl',
        payment_method_types: ['pix'],
        payment_method_data: { type: 'pix' },
        payment_method_options: { pix: { expires_after_seconds: 3600 } },
        confirm: true,
        description: 'LoveVibe VIP PRÓ - Assinatura',
        metadata: { user_id: user.id },
      },
      { idempotencyKey: crypto.randomUUID() }
    );

    const qrCode = paymentIntent.next_action?.pix_display_qr_code;
    if (!qrCode?.data) {
      throw new Error('Stripe não retornou o QR code do Pix.');
    }

    // image_data_url comes back as "data:image/png;base64,<...>" — strip the
    // prefix since the client only wants the raw base64 payload.
    const qrCodeBase64 = qrCode.image_data_url?.split(',')[1] ?? null;

    return jsonResponse(
      {
        payment_id: paymentIntent.id,
        qr_code: qrCode.data,
        qr_code_base64: qrCodeBase64,
      },
      200
    );
  } catch (error) {
    console.error(error);
    // Surface Stripe's own error message when we have one (e.g. Pix not
    // enabled for this account, invalid amount) instead of a generic
    // message that hides the real cause.
    const message = error instanceof Stripe.errors.StripeError ? error.message : null;
    return jsonResponse({ error: message || 'Não foi possível gerar o Pix. Tente novamente.' }, 500);
  }
});
