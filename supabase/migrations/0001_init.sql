-- LoveVibe initial schema: profiles, posts, likes, comments, friendships,
-- messages, group rooms, storage buckets, and RLS policies.

create extension if not exists pgcrypto;

-- =========================================================================
-- PROFILES
-- =========================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  name text not null,
  phone text,
  age int,
  gender text not null default 'Feminino',
  is_couple boolean not null default false,
  is_pro boolean not null default false,
  avatar_url text,
  cover_url text,
  bio text default '',
  location text,
  interests text[] not null default '{}',
  pref_age_min int not null default 18,
  pref_age_max int not null default 99,
  pref_genders text[] not null default '{}',
  pref_location text,
  partner1 jsonb,
  partner2 jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up, sourced from the
-- signUp() `options.data` metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, username, name, phone, age, gender, is_couple,
    avatar_url, cover_url, bio, location, interests,
    pref_age_min, pref_age_max, pref_genders, pref_location,
    partner1, partner2
  ) values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'username'),
    new.raw_user_meta_data ->> 'phone',
    nullif(new.raw_user_meta_data ->> 'age', '')::int,
    coalesce(new.raw_user_meta_data ->> 'gender', 'Feminino'),
    coalesce((new.raw_user_meta_data ->> 'is_couple')::boolean, false),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(
      new.raw_user_meta_data ->> 'cover_url',
      'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80'
    ),
    coalesce(new.raw_user_meta_data ->> 'bio', ''),
    new.raw_user_meta_data ->> 'location',
    coalesce(
      (select array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'interests'))),
      '{}'
    ),
    coalesce((new.raw_user_meta_data ->> 'pref_age_min')::int, 18),
    coalesce((new.raw_user_meta_data ->> 'pref_age_max')::int, 99),
    coalesce(
      (select array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'pref_genders'))),
      '{}'
    ),
    new.raw_user_meta_data ->> 'pref_location',
    new.raw_user_meta_data -> 'partner1',
    new.raw_user_meta_data -> 'partner2'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- POSTS
-- =========================================================================
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'text',
  content text,
  media_url text,
  created_at timestamptz not null default now()
);

create index posts_user_id_idx on public.posts (user_id);
create index posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

create policy "Posts are publicly readable"
  on public.posts for select
  using (true);

create policy "Users can create their own posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

-- =========================================================================
-- POST LIKES
-- =========================================================================
create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_post_id_idx on public.post_likes (post_id);

alter table public.post_likes enable row level security;

create policy "Post likes are publicly readable"
  on public.post_likes for select
  using (true);

create policy "Users can like posts as themselves"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike their own likes"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- COMMENTS
-- =========================================================================
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index comments_post_id_idx on public.comments (post_id);

alter table public.comments enable row level security;

create policy "Comments are publicly readable"
  on public.comments for select
  using (true);

create policy "Users can comment as themselves"
  on public.comments for insert
  with check (auth.uid() = user_id);

-- =========================================================================
-- FRIENDSHIPS
-- =========================================================================
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id_1 uuid not null references public.profiles (id) on delete cascade,
  user_id_2 uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('PENDING', 'ACCEPTED')),
  requester_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create unique index friendships_unique_pair
  on public.friendships (least(user_id_1, user_id_2), greatest(user_id_1, user_id_2));
create index friendships_user_id_1_idx on public.friendships (user_id_1);
create index friendships_user_id_2_idx on public.friendships (user_id_2);

alter table public.friendships enable row level security;

create policy "Users can read their own friendships"
  on public.friendships for select
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

create policy "Users can send friend requests as themselves"
  on public.friendships for insert
  with check (
    auth.uid() = requester_id
    and (auth.uid() = user_id_1 or auth.uid() = user_id_2)
  );

create policy "Participants can update a friendship"
  on public.friendships for update
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2)
  with check (auth.uid() = user_id_1 or auth.uid() = user_id_2);

create policy "Participants can delete a friendship"
  on public.friendships for delete
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

-- =========================================================================
-- DIRECT MESSAGES (sending requires the sender to be a PRO member)
-- =========================================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  text text,
  media_url text,
  created_at timestamptz not null default now()
);

create index messages_participants_idx on public.messages (sender_id, receiver_id);

alter table public.messages enable row level security;

create policy "Participants can read their messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "PRO members can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and (
      sender_id = receiver_id
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_pro)
    )
  );

-- =========================================================================
-- GROUP ROOMS (PRO-only content)
-- =========================================================================
create table public.group_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon_key text not null,
  color text not null,
  member_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.group_rooms enable row level security;

create policy "Authenticated users can list group rooms"
  on public.group_rooms for select
  using (auth.uid() is not null);

create table public.group_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.group_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index group_room_messages_room_id_idx on public.group_room_messages (room_id);

alter table public.group_room_messages enable row level security;

create policy "PRO members can read group messages"
  on public.group_room_messages for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_pro));

create policy "PRO members can send group messages"
  on public.group_room_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_pro)
  );

insert into public.group_rooms (slug, name, description, icon_key, color, member_count) values
  ('group_couples', 'Espaço Casais VIP', 'Bate-papo exclusivo para casais trocarem experiências, dicas de relacionamento e vivências a dois.', 'Flame', 'from-[#ff4b72] to-[#d91b5c]', 142),
  ('group_wine', 'Vinho & Encontros Sofisticados', 'Espaço para apreciadores de enofilia, gastronomia e encontros elegantes.', 'Wine', 'from-amber-600 to-rose-700', 98),
  ('group_travel', 'Viagens & Destinos Românticos', 'Dicas de viagens, passeios, praias paradisíacas e roteiros inesquecíveis.', 'Plane', 'from-purple-600 to-indigo-600', 185),
  ('group_nightlife', 'Festas & Baladas VIP', 'Eventos exclusivos, festas privadas e lista VIP para membros do LoveVibe.', 'Music', 'from-pink-600 to-rose-600', 220);

-- =========================================================================
-- STORAGE: avatars (avatar/cover images) and media (post/chat images)
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users manage their own avatar folder (insert)"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users manage their own avatar folder (update)"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users manage their own avatar folder (delete)"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read media"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "Users manage their own media folder (insert)"
  on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users manage their own media folder (update)"
  on storage.objects for update
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users manage their own media folder (delete)"
  on storage.objects for delete
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
