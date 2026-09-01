// Receives Stripe's payment event notifications. The request is verified
// via its `stripe-signature` header against STRIPE_WEBHOOK_SECRET before
// any of its contents are trusted.
// Deployed WITHOUT JWT verification (Stripe doesn't send a Supabase user
// token) but every write it makes uses the service role key, which bypasses
// RLS — this function is the only writer of payment_transactions.
//
// Required secrets (set with `supabase secrets set`):
//   STRIPE_SECRET_KEY      - same Secret key used by stripe-checkout
//   STRIPE_WEBHOOK_SECRET  - signing secret for this endpoint, from the
//                             Stripe Dashboard (or `stripe listen`)
//
// Configure this URL as the endpoint in your Stripe Dashboard's Webhooks
// settings, listening for `checkout.session.completed`,
// `checkout.session.async_payment_succeeded`,
// `checkout.session.async_payment_failed` and `payment_intent.succeeded`.
//
// Delayed payment methods (Boleto, Pix via Checkout, etc.) complete the
// Checkout Session immediately with payment_status "unpaid" — the actual
// confirmation, days later, arrives as `checkout.session.async_payment_*`,
// never as another `checkout.session.completed`. Without listening for
// `async_payment_succeeded` a Boleto payment would never grant PRO.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.7.0';

Deno.serve(async (req) => {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('stripe-signature');

  if (!secretKey || !webhookSecret || !signature) {
    console.error('Stripe webhook not configured (missing secret or signature header)');
    return new Response('ok', { status: 200 });
  }

  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (error) {
    console.error('Invalid Stripe webhook signature', error);
    return new Response('invalid signature', { status: 400 });
  }

  try {
    let userId: string | null = null;
    let providerPaymentId: string | null = null;
    let providerSessionId: string | null = null;
    let status: string | null = null;
    let amountCents: number | null = null;

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      userId = session.client_reference_id || session.metadata?.user_id || null;
      providerPaymentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);
      providerSessionId = session.id;
      status =
        event.type === 'checkout.session.async_payment_failed'
          ? 'failed'
          : session.payment_status === 'paid'
            ? 'approved'
            : session.payment_status;
      amountCents = session.amount_total ?? null;
    } else if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      userId = paymentIntent.metadata?.user_id || null;
      providerPaymentId = paymentIntent.id;
      status = 'approved';
      amountCents = paymentIntent.amount ?? null;
    } else {
      // Not an event we act on (e.g. payment_intent.created, charge.updated).
      return new Response('ok', { status: 200 });
    }

    if (!userId || !providerPaymentId) {
      return new Response('ok', { status: 200 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    );

    // Stripe can (and does) deliver more than one event for the same
    // payment — e.g. a Checkout-based Boleto payment fires both
    // `checkout.session.async_payment_succeeded` and
    // `payment_intent.succeeded`, and Stripe also retries undelivered
    // events. Without this check, each additional event for an
    // already-approved payment would extend pro_expires_at by another
    // month on top of the last one.
    const { data: existing } = await supabaseAdmin
      .from('payment_transactions')
      .select('status')
      .eq('provider_payment_id', providerPaymentId)
      .maybeSingle();
    const alreadyApproved = existing?.status === 'approved';

    await supabaseAdmin.from('payment_transactions').upsert(
      {
        user_id: userId,
        provider: 'stripe',
        provider_payment_id: providerPaymentId,
        provider_session_id: providerSessionId,
        status,
        amount_cents: amountCents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider_payment_id' }
    );

    if (status === 'approved' && !alreadyApproved) {
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
    // Always 200 so Stripe doesn't hammer retries over an internal error —
    // the payment can still be reconciled manually if needed.
    return new Response('ok', { status: 200 });
  }
});
