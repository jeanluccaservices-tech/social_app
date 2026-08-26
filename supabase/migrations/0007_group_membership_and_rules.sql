-- Real group membership (previously "member_count" was a fake seeded
-- number and there was no concept of actually belonging to a room — every
-- PRO member could read/send in every room). "Entrar na Sala" now records
-- membership, room lists split into "my groups" vs "explore", and each
-- room can declare an eligibility rule for who's allowed to join.

alter table public.group_rooms
  add column rule_type text not null default 'none'
    check (rule_type in ('none', 'couples_only', 'singles_only', 'location')),
  add column rule_value text;

-- The existing "Espaço Casais VIP" room is couples-only; the rest stay open
-- to any PRO member (rule_type 'none').
update public.group_rooms set rule_type = 'couples_only' where slug = 'group_couples';

create table public.group_room_members (
  room_id uuid not null references public.group_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index group_room_members_user_id_idx on public.group_room_members (user_id);

alter table public.group_room_members enable row level security;

create policy "Authenticated users can see room membership"
  on public.group_room_members for select
  using (auth.uid() is not null);

create policy "PRO members can join rooms they're eligible for"
  on public.group_room_members for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_pro)
    and exists (
      select 1 from public.group_rooms r
      where r.id = room_id
      and (
        r.rule_type = 'none'
        or (r.rule_type = 'couples_only' and exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.is_couple
        ))
        or (r.rule_type = 'singles_only' and exists (
          select 1 from public.profiles p where p.id = auth.uid() and not p.is_couple
        ))
        or (r.rule_type = 'location' and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.location ilike '%' || r.rule_value || '%'
        ))
      )
    )
  );

create policy "Members can leave rooms"
  on public.group_room_members for delete
  using (auth.uid() = user_id);

-- Reading/sending group messages now requires actual membership, not just
-- being PRO in the abstract — matches "explore" (read the room's info) vs
-- "joined" (participate in it).
drop policy "PRO members can read group messages" on public.group_room_messages;
create policy "Room members can read group messages"
  on public.group_room_messages for select
  using (exists (
    select 1 from public.group_room_members m
    where m.room_id = group_room_messages.room_id and m.user_id = auth.uid()
  ));

drop policy "PRO members can send group messages" on public.group_room_messages;
create policy "Room members can send group messages"
  on public.group_room_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.group_room_members m
      where m.room_id = group_room_messages.room_id and m.user_id = sender_id
    )
  );
