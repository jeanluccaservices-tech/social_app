-- =========================================================================
-- ACCOUNT DELETION
-- =========================================================================
-- Archive of accounts that deleted themselves. Every FK to profiles(id) is
-- already ON DELETE CASCADE (posts, comments, post_likes, messages in both
-- directions, friendships, group_room_*, notifications, payment records),
-- so deleting the auth.users row alone makes all of that content vanish.
-- This table is the only trace left behind, for moderation/support only —
-- it has RLS enabled with no policies, so no client role can read it.
create table public.deleted_accounts (
  id uuid primary key,
  username text,
  name text,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_accounts enable row level security;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.deleted_accounts (id, username, name, deleted_at)
  select id, username, name, now()
  from public.profiles
  where id = auth.uid();

  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

-- =========================================================================
-- BLOCKING
-- =========================================================================
create table public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocked_users_blocker_idx on public.blocked_users (blocker_id);
create index blocked_users_blocked_idx on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

create policy "Users can read their own block list"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

-- Writes go through the RPCs below (so blocking can also clear any
-- friendship atomically) — no direct insert/delete policy needed.

create or replace function public.block_user(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if target_user_id is null or target_user_id = auth.uid() then
    return;
  end if;

  insert into public.blocked_users (blocker_id, blocked_id)
  values (auth.uid(), target_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.friendships
  where (user_id_1 = auth.uid() and user_id_2 = target_user_id)
     or (user_id_1 = target_user_id and user_id_2 = auth.uid());
end;
$$;

grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.blocked_users
  where blocker_id = auth.uid() and blocked_id = target_user_id;
end;
$$;

grant execute on function public.unblock_user(uuid) to authenticated;

-- Hide profiles, posts and comments in either direction of a block —
-- neither side should see the other anywhere in the app.
drop policy "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read non-blocked profiles"
  on public.profiles for select
  using (
    auth.uid() is not null
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = auth.uid() and b.blocked_id = profiles.id)
         or (b.blocker_id = profiles.id and b.blocked_id = auth.uid())
    )
  );

drop policy "Authenticated users can read non-deleted posts" on public.posts;
create policy "Authenticated users can read non-deleted, non-blocked posts"
  on public.posts for select
  using (
    auth.uid() is not null and deleted_at is null
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = auth.uid() and b.blocked_id = posts.user_id)
         or (b.blocker_id = posts.user_id and b.blocked_id = auth.uid())
    )
  );

drop policy "Authenticated users can read non-deleted comments" on public.comments;
create policy "Authenticated users can read non-deleted, non-blocked comments"
  on public.comments for select
  using (
    auth.uid() is not null and deleted_at is null
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = auth.uid() and b.blocked_id = comments.user_id)
         or (b.blocker_id = comments.user_id and b.blocked_id = auth.uid())
    )
  );

-- Block new messages between blocked pairs — the rows themselves aren't
-- deleted. Note this is a DB-level statement only: since profiles are also
-- hidden from each other above, the client (ChatView's contact list, which
-- reads from the same RLS-filtered profiles) currently can't render that
-- past conversation at all either — the blocked contact disappears from
-- the chat list, not just from receiving new messages.
drop policy "PRO members can send messages, others can reply to PRO senders" on public.messages;
create policy "PRO members can send messages, others can reply to PRO senders"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = auth.uid() and b.blocked_id = messages.receiver_id)
         or (b.blocker_id = messages.receiver_id and b.blocked_id = auth.uid())
    )
    and (
      sender_id = receiver_id
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.pro_expires_at > now())
      or exists (
        select 1 from public.messages m
        where m.sender_id = messages.receiver_id and m.receiver_id = auth.uid()
      )
    )
    and (
      media_url is null
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.pro_expires_at > now())
    )
  );
