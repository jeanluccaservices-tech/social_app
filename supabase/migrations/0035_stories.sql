-- =========================================================================
-- STORIES — ephemeral posts that disappear 24h after being created. Each
-- one carries its own audience, chosen by whoever posts it: 'everyone' or
-- 'friends' (only accepted friends of the author can see it).
-- =========================================================================
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_url text not null,
  visibility text not null check (visibility in ('everyone', 'friends')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index stories_user_id_idx on public.stories (user_id);
create index stories_expires_at_idx on public.stories (expires_at);

alter table public.stories enable row level security;

-- Same "hidden from/to a blocked pair" rule already applied to posts and
-- comments (0023), plus the audience choice: the author always sees their
-- own story; everyone else needs 'everyone' visibility, or to be an
-- accepted friend when it's 'friends'-only. Expiry itself is enforced by
-- the client's query (`expires_at > now()`), not by this policy — a story
-- author can still fetch their own past stories if some future screen
-- wants that.
create policy "Stories visible per author's chosen audience"
  on public.stories for select
  using (
    auth.uid() is not null
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = auth.uid() and b.blocked_id = stories.user_id)
         or (b.blocker_id = stories.user_id and b.blocked_id = auth.uid())
    )
    and (
      user_id = auth.uid()
      or visibility = 'everyone'
      or (
        visibility = 'friends' and exists (
          select 1 from public.friendships f
          where f.status = 'ACCEPTED'
            and ((f.user_id_1 = auth.uid() and f.user_id_2 = stories.user_id)
              or (f.user_id_1 = stories.user_id and f.user_id_2 = auth.uid()))
        )
      )
    )
  );

create policy "Users can post their own stories"
  on public.stories for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own stories"
  on public.stories for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- STORY VIEWS — who has seen a story, so the author can see a view count
-- and the viewer's own client can tell "seen" apart from "unseen" rings.
-- Deliberately NOT readable by other viewers (only the story's own author
-- can list them) — same anonymity posture used for poll votes.
-- =========================================================================
create table public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (story_id, viewer_id)
);

create index story_views_story_id_idx on public.story_views (story_id);

alter table public.story_views enable row level security;

create policy "Story authors can see who viewed"
  on public.story_views for select
  using (exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));

create policy "Viewers can see their own view record"
  on public.story_views for select
  using (auth.uid() = viewer_id);

create policy "Users can record their own story view"
  on public.story_views for insert
  with check (auth.uid() = viewer_id);
