-- =========================================================================
-- POST REPORTS
-- =========================================================================
create table public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.post_reports enable row level security;

create policy "Users can report posts as themselves"
  on public.post_reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can see their own reports"
  on public.post_reports for select
  using (auth.uid() = reporter_id);

-- =========================================================================
-- PAYMENT TRANSACTIONS (Mercado Pago) — written only by the mp-webhook
-- edge function via the service role; never directly by clients.
-- =========================================================================
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mp_payment_id text not null unique,
  mp_preference_id text,
  status text not null,
  amount_cents int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_transactions_user_id_idx on public.payment_transactions (user_id);

alter table public.payment_transactions enable row level security;

create policy "Users can see their own payment history"
  on public.payment_transactions for select
  using (auth.uid() = user_id);
