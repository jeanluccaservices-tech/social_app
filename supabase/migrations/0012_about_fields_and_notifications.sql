-- Optional "About" info a person can fill in after their profile already
-- exists (shown in a dedicated tab on their profile).
alter table public.profiles
  add column height_cm int,
  add column weight_kg int,
  add column smokes text,
  add column drinks text,
  add column sexual_orientation text,
  add column marital_status text;

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('post_like', 'post_comment', 'friend_request', 'friend_accepted')),
  post_id uuid references public.posts (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can read their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Notifications are only ever written by the trigger functions below
-- (security definer), never inserted directly by clients.

create or replace function public.notify_post_like()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner from public.posts where id = new.post_id;
  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (post_owner, new.user_id, 'post_like', new.post_id);
  end if;
  return new;
end;
$$;

create trigger on_post_like_created
  after insert on public.post_likes
  for each row execute function public.notify_post_like();

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner from public.posts where id = new.post_id;
  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (post_owner, new.user_id, 'post_comment', new.post_id);
  end if;
  return new;
end;
$$;

create trigger on_post_comment_created
  after insert on public.comments
  for each row execute function public.notify_post_comment();

create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recipient uuid;
begin
  if new.status = 'PENDING' then
    recipient := case when new.user_id_1 = new.requester_id then new.user_id_2 else new.user_id_1 end;
    insert into public.notifications (user_id, actor_id, type)
    values (recipient, new.requester_id, 'friend_request');
  end if;
  return new;
end;
$$;

create trigger on_friendship_created
  after insert on public.friendships
  for each row execute function public.notify_friend_request();

create or replace function public.notify_friend_accepted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recipient uuid;
  accepter uuid;
begin
  if new.status = 'ACCEPTED' and old.status is distinct from 'ACCEPTED' then
    recipient := new.requester_id;
    accepter := case when new.user_id_1 = recipient then new.user_id_2 else new.user_id_1 end;
    insert into public.notifications (user_id, actor_id, type)
    values (recipient, accepter, 'friend_accepted');
  end if;
  return new;
end;
$$;

create trigger on_friendship_accepted
  after update on public.friendships
  for each row execute function public.notify_friend_accepted();
