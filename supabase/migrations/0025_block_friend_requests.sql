-- Blocking already closes new messages and hides profiles/posts/comments
-- between the two parties (0023), but the friendships INSERT policy never
-- got the same check. No UI surface can show a blocked profile to send a
-- request to, but that's a soft, client-side guarantee only — anyone
-- calling the client directly with a cached/guessed id could still insert
-- a friend request against someone they (or who) blocked. Close it here,
-- the one place that actually enforces it.
drop policy "Users can send friend requests as themselves" on public.friendships;
create policy "Users can send friend requests as themselves"
  on public.friendships for insert
  with check (
    auth.uid() = requester_id
    and (auth.uid() = user_id_1 or auth.uid() = user_id_2)
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = user_id_1 and b.blocked_id = user_id_2)
         or (b.blocker_id = user_id_2 and b.blocked_id = user_id_1)
    )
  );
