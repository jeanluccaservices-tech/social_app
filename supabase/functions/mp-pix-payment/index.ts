// Creates a Pix payment directly via Mercado Pago's Payments API (not
// Checkout Pro — Pix needs its own dedicated flow so we can show the QR
// code / copy-paste code right here in the app instead of redirecting).
// PRO is activated by the mp-webhook Edge Function once Mercado Pago
// confirms the payment — this function only creates the charge and hands
// back what's needed to display it.
//
// Requires a logged-in user (deployed WITH JWT verification).
//
// Body: { cpf: string } — Pix in Brazil requires the payer's CPF.
//
// Required secret (set with `supabase secrets set`):
//   MERCADOPAGO_ACCESS_TOKEN  - same Access Token used by mp-checkout
import { createClient } from 'npm:@supabase/supabase-js@2';

const PRO_PRICE_BRL = 29.9;

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

  const body = await req.json().catch(() => null);
  const cpf = (body?.cpf ?? '').replace(/\D/g, '');
  if (cpf.length !== 11) {
    return jsonResponse({ error: 'Informe um CPF válido (11 dígitos).' }, 400);
  }

  // Best-effort name split for Mercado Pago's payer record — not shown to
  // the payer, just required by the Pix payment schema.
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
  const fullName = (profile?.name || user.email || 'Cliente LoveVibe').split(' & ')[0].trim();
  const nameParts = fullName.split(' ').filter(Boolean);
  const firstName = nameParts[0] || 'Cliente';
  const lastName = nameParts.slice(1).join(' ') || firstName;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  try {
    const paymentRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: PRO_PRICE_BRL,
        description: 'LoveVibe VIP PRÓ - Assinatura',
        payment_method_id: 'pix',
        payer: {
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          identification: { type: 'CPF', number: cpf },
        },
        external_reference: user.id,
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      }),
    });

    const payment = await paymentRes.json();

    if (!paymentRes.ok) {
      // Common setup error: the seller's Mercado Pago account doesn't have
      // a Pix key enabled yet, so it can't receive Pix payments at all.
      if (payment?.message?.includes('Collector user without key enabled')) {
        return jsonResponse(
          {
            error:
              'O Pix ainda não está habilitado na conta Mercado Pago do LoveVibe. Tente Cartão ou Boleto por enquanto.',
          },
          503
        );
      }
      throw new Error(payment?.message || 'Falha ao gerar cobrança Pix.');
    }

    const txData = payment?.point_of_interaction?.transaction_data;
    if (!txData?.qr_code) {
      throw new Error('Mercado Pago não retornou o QR code do Pix.');
    }

    return jsonResponse(
      {
        payment_id: payment.id,
        qr_code: txData.qr_code,
        qr_code_base64: txData.qr_code_base64,
      },
      200
    );
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: 'Não foi possível gerar o Pix. Tente novamente.' }, 500);
  }
});
