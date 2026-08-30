-- 0023 hides a blocked profile from its blocker everywhere (profiles RLS),
-- which is right for feeds/chat but also means the blocker can't see who's
-- even on their own block list to review or undo it. This function reads
-- past that RLS as security definer, but only ever returns rows the caller
-- themselves blocked (blocker_id = auth.uid()) — never someone else's list.
create or replace function public.get_blocked_profiles()
returns table (
  id uuid,
  username text,
  name text,
  avatar_url text,
  is_couple boolean
)
language sql
security definer set search_path = public
as $$
  select p.id, p.username, p.name, p.avatar_url, p.is_couple
  from public.blocked_users b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

grant execute on function public.get_blocked_profiles() to authenticated;
