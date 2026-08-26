-- Logged-out visitors must not be able to see registered members' profiles,
-- photos, or posts. These were previously world-readable (`using (true)`);
-- restrict all of them to authenticated sessions.
drop policy "Profiles are publicly readable" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select
  using (auth.uid() is not null);

drop policy "Posts are publicly readable" on public.posts;
create policy "Authenticated users can read posts"
  on public.posts for select
  using (auth.uid() is not null);

drop policy "Post likes are publicly readable" on public.post_likes;
create policy "Authenticated users can read post likes"
  on public.post_likes for select
  using (auth.uid() is not null);

drop policy "Comments are publicly readable" on public.comments;
create policy "Authenticated users can read comments"
  on public.comments for select
  using (auth.uid() is not null);
