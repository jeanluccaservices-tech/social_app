// Creates a Stripe Checkout Session for the LoveVibe PRO subscription and
// returns the hosted checkout URL for the client to redirect to. There is
// deliberately no `payment_method_types` set — Checkout shows whatever
// methods (card, boleto, Pix, ...) are enabled in the Stripe account's
// Dashboard (Settings > Payment methods) automatically, so turning Pix on
// there is enough to add it here, no code change needed.
// Requires a logged-in user (this function is deployed WITH JWT
// verification, unlike send-email/stripe-webhook).
//
// The success_url/cancel_url (where Stripe redirects the shopper back to
// after paying) are derived from the request's own Origin/Referer header,
// so the redirect always lands back on whatever host the app was loaded
// from (production domain, a preview deploy, localhost, an ngrok tunnel
// during development, etc.) without needing a secret to be kept in sync.
// SITE_URL is only a fallback for requests that don't send either header.
//
// Required secrets (set with `supabase secrets set`):
//   STRIPE_SECRET_KEY  - Secret key from the Stripe account that will
//                         receive the payments
//   SITE_URL           - fallback checkout redirect URL (see above)
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';
import { checkRateLimit, clientIdentity } from '../_shared/rateLimit.ts';

const PRO_PRICE_BRL = 24.9;

// Called directly from the browser via supabase.functions.invoke(), so it
// needs CORS headers on every response, including the OPTIONS preflight.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Prefers the browser-sent Origin header, falls back to Referer's origin,
// then to the SITE_URL secret — so the redirect target tracks whatever
// host the app is actually running on instead of a fixed value.
const resolveSiteUrl = (req: Request): string => {
  const origin = req.headers.get('origin');
  if (origin) return origin;

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // fall through to the secret/default below
    }
  }

  return Deno.env.get('SITE_URL') || 'https://example.com';
};

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
  const withinLimit = await checkRateLimit(supabaseAdmin, `stripe-checkout:${clientIdentity(req, user.id)}`, 5, 600);
  if (!withinLimit) {
    return jsonResponse({ error: 'Muitas tentativas de pagamento. Aguarde alguns minutos e tente novamente.' }, 429);
  }

  const siteUrl = resolveSiteUrl(req);
  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: Math.round(PRO_PRICE_BRL * 100),
            product_data: { name: 'LoveVibe VIP PRÓ - Assinatura' },
          },
          quantity: 1,
        },
      ],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      success_url: siteUrl,
      cancel_url: siteUrl,
    });

    return jsonResponse({ url: session.url }, 200);
  } catch (error) {
    console.error(error);
    const message = error instanceof Stripe.errors.StripeError ? error.message : null;
    return jsonResponse({ error: message || 'Não foi possível iniciar o pagamento. Tente novamente.' }, 500);
  }
});
