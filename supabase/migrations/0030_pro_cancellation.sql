-- Tracks whether a PRO payment has already been refunded, so the
-- cancel-pro-subscription Edge Function can find the latest un-refunded
-- payment for a user and never refund the same charge twice.
alter table public.payment_transactions
  add column refunded_at timestamptz;

comment on column public.payment_transactions.refunded_at is
  'Set when this payment was refunded via the cancel-pro-subscription Edge Function (7-day withdrawal right, CDC art. 49). Null means never refunded.';
