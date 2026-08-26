-- Locking profiles reads to authenticated-only (0006) broke the pre-signup
-- "is this username taken?" check — an anonymous signer-upper can't SELECT
-- from profiles at all, so it silently always said "available", letting
-- duplicate usernames reach the DB and fail as a raw, unfriendly
-- "Database error saving new user". This RPC exposes only a yes/no
-- availability answer (no profile data), safe to call while logged out.
create or replace function public.is_username_taken(check_username text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists(select 1 from public.profiles where username = check_username);
$$;

grant execute on function public.is_username_taken(text) to anon, authenticated;
