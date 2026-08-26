-- Soft delete for posts and comments: the row stays (for referential
-- integrity / moderation history) but is hidden from reads once the owner
-- deletes it.
alter table public.posts add column deleted_at timestamptz;
alter table public.comments add column deleted_at timestamptz;

drop policy "Authenticated users can read posts" on public.posts;
create policy "Authenticated users can read non-deleted posts"
  on public.posts for select
  using (auth.uid() is not null and deleted_at is null);

create policy "Users can soft-delete their own posts"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy "Authenticated users can read comments" on public.comments;
create policy "Authenticated users can read non-deleted comments"
  on public.comments for select
  using (auth.uid() is not null and deleted_at is null);

create policy "Users can soft-delete their own comments"
  on public.comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
