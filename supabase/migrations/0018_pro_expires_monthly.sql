-- PRO access lasts 1 month from payment and does NOT auto-renew — replace
-- the permanent `is_pro` flag with an expiry timestamp, which is the only
-- source of truth for "is this account currently PRO" everywhere (RLS and
-- the client both derive it from this, nothing caches a stale boolean).
alter table public.profiles add column pro_expires_at timestamptz;

drop policy "PRO members can join rooms they're eligible for" on public.group_room_members;
create policy "PRO members can join rooms they're eligible for"
  on public.group_room_members for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.pro_expires_at > now())
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

drop policy "PRO members can send messages, others can reply to PRO senders" on public.messages;
create policy "PRO members can send messages, others can reply to PRO senders"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and (
      sender_id = receiver_id
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.pro_expires_at > now())
      or exists (
        select 1 from public.messages m
        where m.sender_id = receiver_id and m.receiver_id = auth.uid()
      )
    )
    and (
      media_url is null
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.pro_expires_at > now())
    )
  );

-- Signup can no longer grant PRO for free — drop the column entirely so
-- there's exactly one place ("pro_expires_at", set only by mp-webhook)
-- that can ever mark an account PRO.
alter table public.profiles drop column is_pro;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, username, name, phone, birth_date, gender, is_couple, age_confirmed,
    avatar_url, cover_url, bio, location, interests,
    pref_age_min, pref_age_max, pref_genders, pref_radius_km,
    partner1, partner2
  ) values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'username'),
    new.raw_user_meta_data ->> 'phone',
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
    coalesce(new.raw_user_meta_data ->> 'gender', 'Feminino'),
    coalesce((new.raw_user_meta_data ->> 'is_couple')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'age_confirmed')::boolean, false),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'cover_url',
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
    coalesce((new.raw_user_meta_data ->> 'pref_radius_km')::int, 50),
    new.raw_user_meta_data -> 'partner1',
    new.raw_user_meta_data -> 'partner2'
  );
  return new;
end;
$$;
