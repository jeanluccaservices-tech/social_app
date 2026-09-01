-- Exposes just the friend count of any profile (not just the logged-in
-- user's own friendships, which is all the "read your own friendships" RLS
-- policy on `friendships` allows a client to SELECT directly).
create or replace function public.friend_count(target_user_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from friendships
  where status = 'ACCEPTED'
    and (user_id_1 = target_user_id or user_id_2 = target_user_id);
$$;

grant execute on function public.friend_count(uuid) to authenticated;
