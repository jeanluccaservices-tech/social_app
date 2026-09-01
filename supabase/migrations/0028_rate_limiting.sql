-- =========================================================================
-- RATE LIMITING — generic timestamped "hits" per bucket key, used by Edge
-- Functions to throttle abuse (e.g. "stripe-checkout:user:<uuid>",
-- "pwreset-email:<email>"). Only the service role can touch this table;
-- Edge Functions are the only intended callers, via check_rate_limit().
-- =========================================================================
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_bucket_created_idx on public.rate_limit_hits (bucket_key, created_at);

alter table public.rate_limit_hits enable row level security;
-- No policies: RLS with zero policies denies all access to anon/authenticated;
-- only the service role (which bypasses RLS entirely) can read/write.

create or replace function public.check_rate_limit(p_bucket_key text, p_max_hits int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Opportunistic cleanup so this table doesn't grow forever — there's no
  -- pg_cron in this project, so prune old rows inline instead of via a job.
  delete from public.rate_limit_hits where created_at < now() - interval '2 days';

  select count(*) into v_count
  from public.rate_limit_hits
  where bucket_key = p_bucket_key
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_hits then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket_key) values (p_bucket_key);
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
