-- Lets the request-password-reset Edge Function check whether an e-mail
-- has an account before triggering a recovery e-mail, so nobody gets an
-- e-mail for an address with no account. Mirrors is_username_taken
-- (0019) but reads auth.users (profiles has no e-mail column) and is
-- intentionally NOT exposed to anon/authenticated — this one *does* leak
-- account existence, so only the rate-limited Edge Function (via the
-- service role) may call it, never the browser directly.
create or replace function public.email_exists(check_email text)
returns boolean
language sql
security definer set search_path = public, auth
stable
as $$
  select exists(select 1 from auth.users where lower(email) = lower(check_email));
$$;

revoke all on function public.email_exists(text) from public, anon, authenticated;
grant execute on function public.email_exists(text) to service_role;
