-- =========================================================================
-- PAYMENT TRANSACTIONS: rename Mercado Pago-specific columns to
-- provider-agnostic names now that Stripe is the payment provider.
-- Historical Mercado Pago rows keep their IDs, just under the new columns.
-- =========================================================================
alter table public.payment_transactions
  rename column mp_payment_id to provider_payment_id;

alter table public.payment_transactions
  rename column mp_preference_id to provider_session_id;

alter table public.payment_transactions
  add column provider text not null default 'stripe';

comment on column public.payment_transactions.provider is
  'Payment provider that produced this row (e.g. ''stripe'', ''mercadopago'' for historical rows).';
