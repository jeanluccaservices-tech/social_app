-- Replace the free-typed "age" with a birth date the app computes age
-- from (so it can't drift or be misreported), and replace the separate
-- "preferred location" city with a search radius around the person's own
-- location (e.g. "within 20km of São Paulo, SP").
alter table public.profiles drop constraint profiles_age_of_majority;

alter table public.profiles
  add column birth_date date,
  add column pref_radius_km int not null default 50;

alter table public.profiles
  add constraint profiles_birth_date_of_majority
  check (is_couple or birth_date is null or birth_date <= (current_date - interval '18 years')::date);

alter table public.profiles drop column age;
alter table public.profiles drop column pref_location;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, username, name, phone, birth_date, gender, is_couple, is_pro, age_confirmed,
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
    coalesce((new.raw_user_meta_data ->> 'pref_radius_km')::int, 50),
    new.raw_user_meta_data -> 'partner1',
    new.raw_user_meta_data -> 'partner2'
  );
  return new;
end;
$$;
