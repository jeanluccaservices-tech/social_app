// Receives Mercado Pago's payment notifications. We never trust the
// webhook body directly — we re-fetch the payment from Mercado Pago's API
// using our access token, and only then activate PRO for the paying user.
// Deployed WITHOUT JWT verification (Mercado Pago doesn't send a Supabase
// user token) but every write it makes uses the service role key, which
// bypasses RLS — this function is the only writer of payment_transactions.
//
// Required secret (set with `supabase secrets set`):
//   MERCADOPAGO_ACCESS_TOKEN  - same Access Token used by mp-checkout
//
// Configure this URL as the notification_url in your Mercado Pago
// application/preferences (mp-checkout already does this automatically).
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let paymentId = url.searchParams.get('data.id') || url.searchParams.get('id');

    if (!paymentId && req.method === 'POST') {
      const body = await req.json().catch(() => null);
      paymentId = body?.data?.id ?? null;
    }

    if (!paymentId) {
      // Mercado Pago also pings with unrelated topics (merchant_order, etc).
      return new Response('ok', { status: 200 });
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken || accessToken.startsWith('REPLACE_')) {
      console.error('MERCADOPAGO_ACCESS_TOKEN not configured');
      return new Response('ok', { status: 200 });
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await paymentRes.json();

    const userId = payment?.external_reference;
    if (!userId) {
      return new Response('ok', { status: 200 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    );

    await supabaseAdmin.from('payment_transactions').upsert(
      {
        user_id: userId,
        mp_payment_id: String(payment.id),
        mp_preference_id: payment.preference_id ?? null,
        status: payment.status,
        amount_cents: payment.transaction_amount ? Math.round(payment.transaction_amount * 100) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'mp_payment_id' }
    );

    if (payment.status === 'approved') {
      // PRO lasts 1 month from payment and does not auto-renew. If they
      // paid again before a previous period expired, extend from that
      // expiry instead of from now, so no paid days are lost.
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('pro_expires_at')
        .eq('id', userId)
        .maybeSingle();

      const currentExpiry = profile?.pro_expires_at ? new Date(profile.pro_expires_at) : null;
      const base = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
      const newExpiry = new Date(base);
      newExpiry.setMonth(newExpiry.getMonth() + 1);

      await supabaseAdmin.from('profiles').update({ pro_expires_at: newExpiry.toISOString() }).eq('id', userId);
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error(error);
    // Always 200 so Mercado Pago doesn't hammer retries over an internal
    // error — the payment can still be reconciled manually if needed.
    return new Response('ok', { status: 200 });
  }
});
