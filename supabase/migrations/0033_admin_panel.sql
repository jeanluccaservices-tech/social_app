-- =========================================================================
-- ADMIN PANEL — access control lives entirely here, in the database, not
-- in the client. Hiding the "Admin" tab in the UI is just convenience;
-- every actual admin read/write below is gated by is_admin(), enforced on
-- the server regardless of what the client sends.
-- =========================================================================

-- Allow-list of admin user ids. RLS is enabled with ZERO policies — nobody,
-- not even an admin, can read or write this table directly. The only way
-- in or out is is_admin() below (security definer, runs as table owner).
create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- =========================================================================
-- BANNING — the real ban happens in Supabase Auth itself (auth.users.
-- banned_until, set via the Admin API by the admin-ban-user Edge Function,
-- which is what actually blocks login/refresh). This column just mirrors
-- that value into `profiles` so the client can display/filter banned
-- accounts without a service-role call for every read.
-- =========================================================================
alter table public.profiles add column banned_until timestamptz;

-- =========================================================================
-- REPORTS — admins need to see every report, not just their own, and be
-- able to mark one resolved/ignored (audited: who, when).
-- =========================================================================
alter table public.post_reports add column resolved_at timestamptz;
alter table public.post_reports add column resolved_by uuid references public.profiles (id);

create policy "Admins can see all reports"
  on public.post_reports for select
  using (public.is_admin());

create policy "Admins can resolve reports"
  on public.post_reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- Column-level grant mirrors the pattern in 0017: RLS above already
-- restricts which rows (only if is_admin()), this restricts which columns
-- (only the resolution fields — reason/reporter_id/etc. stay immutable).
grant update (resolved_at, resolved_by) on public.post_reports to authenticated;

-- =========================================================================
-- DELETED ACCOUNTS — moderation-only archive (0023), previously
-- unreadable by any client role at all. Admins can now read it for the
-- "deleted accounts" dashboard count.
-- =========================================================================
create policy "Admins can read deleted accounts"
  on public.deleted_accounts for select
  using (public.is_admin());
