-- Debugging the soft-delete RLS report left a temporary wide-open UPDATE
-- policy on public.posts ("zzz_test_wide_open", using(true)/with check(true)).
-- Remove it and restore the correct owner-only policy.
drop policy if exists "zzz_test_wide_open" on public.posts;
drop policy if exists "Users can soft-delete their own posts" on public.posts;

create policy "Users can soft-delete their own posts"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
