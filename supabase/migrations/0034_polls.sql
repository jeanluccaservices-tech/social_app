-- =========================================================================
-- POLLS — a new posts.type ('poll'), same table/RLS pattern as posts
-- itself. Votes are anonymous: only the voter can read their own row
-- directly (RLS), aggregate counts come only from poll_results() below
-- (security definer), so nobody — not even by querying the table
-- directly — can see who voted for what.
-- =========================================================================
create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  option_text text not null,
  position int not null default 0
);

create index poll_options_post_id_idx on public.poll_options (post_id);

alter table public.poll_options enable row level security;

create policy "Poll options are publicly readable"
  on public.poll_options for select
  using (true);

create policy "Post owner can add poll options"
  on public.poll_options for insert
  with check (exists (
    select 1 from public.posts where posts.id = post_id and posts.user_id = auth.uid()
  ));

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index poll_votes_post_id_idx on public.poll_votes (post_id);

alter table public.poll_votes enable row level security;

create policy "Users can see their own vote"
  on public.poll_votes for select
  using (auth.uid() = user_id);

create policy "Users can vote as themselves"
  on public.poll_votes for insert
  with check (auth.uid() = user_id);

create policy "Users can change their own vote"
  on public.poll_votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Single-choice: one row per (post_id, user_id), enforced by the unique
-- index above — voting again just changes the existing row (see the
-- client's upsert), it never adds a second vote.
create or replace function public.poll_results(target_post_id uuid)
returns table(option_id uuid, votes int)
language sql
security definer
set search_path = public
stable
as $$
  select po.id, count(pv.id)::int
  from public.poll_options po
  left join public.poll_votes pv on pv.option_id = po.id
  where po.post_id = target_post_id
  group by po.id;
$$;

grant execute on function public.poll_results(uuid) to authenticated;
