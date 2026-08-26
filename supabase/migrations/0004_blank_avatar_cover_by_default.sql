-- New profiles start with no avatar/cover photo at all (the UI shows a
-- neutral placeholder) instead of a stock Unsplash photo, until the person
-- uploads their own via Edit Profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, username, name, phone, age, gender, is_couple, is_pro, age_confirmed,
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
    coalesce((new.raw_user_meta_data ->> 'is_pro')::boolean, false),
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
    new.raw_user_meta_data ->> 'pref_location',
    new.raw_user_meta_data -> 'partner1',
    new.raw_user_meta_data -> 'partner2'
  );
  return new;
end;
$$;

-- Backfill: strip the old stock cover photo from any existing profiles that
-- never set their own (harmless no-op if the table is empty).
update public.profiles
set cover_url = null
where cover_url = 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80';
