// Creates a Mercado Pago "Checkout Pro" preference for the LoveVibe PRO
// subscription (card or boleto — Pix has its own flow, see mp-pix-payment)
// and returns the hosted checkout URL for the client to redirect to.
// Requires a logged-in user (this function is deployed WITH JWT
// verification, unlike send-email/mp-webhook).
//
// Required secret (set with `supabase secrets set`):
//   MERCADOPAGO_ACCESS_TOKEN  - Access Token from the Mercado Pago account
//                                that will receive the payments
//   SITE_URL                  - the deployed app's URL, used for the
//                                checkout's back_urls (where Mercado Pago
//                                redirects the shopper after paying)
import { createClient } from 'npm:@supabase/supabase-js@2';

const PRO_PRICE_BRL = 29.9;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!accessToken || accessToken.startsWith('REPLACE_')) {
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

  const siteUrl = Deno.env.get('SITE_URL') || 'https://example.com';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  try {
    const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: 'LoveVibe VIP PRÓ - Assinatura',
            quantity: 1,
            unit_price: PRO_PRICE_BRL,
            currency_id: 'BRL',
          },
        ],
        payer: { email: user.email },
        external_reference: user.id,
        back_urls: {
          success: siteUrl,
          failure: siteUrl,
          pending: siteUrl,
        },
        auto_return: 'approved',
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
        // Pix has its own dedicated flow (mp-pix-payment) with an in-app
        // QR code — only card and boleto go through this hosted checkout.
        payment_methods: {
          excluded_payment_types: [{ id: 'bank_transfer' }],
        },
      }),
    });

    const pref = await prefRes.json();

    if (!prefRes.ok) {
      throw new Error(pref?.message || 'Falha ao criar preferência de pagamento.');
    }

    return jsonResponse({ init_point: pref.init_point }, 200);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: 'Não foi possível iniciar o pagamento. Tente novamente.' }, 500);
  }
});
