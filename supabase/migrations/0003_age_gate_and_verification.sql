-- Age-of-majority enforcement + signup consent tracking.
-- The app already blocks signup client-side for under-18s, but the checks
-- below make that a DB-level guarantee, not just a UI nicety.

alter table public.profiles
  add column age_confirmed boolean not null default false,
  add column terms_accepted_at timestamptz not null default now();

alter table public.profiles
  add constraint profiles_age_of_majority
  check (is_couple or age is null or age >= 18);

alter table public.profiles
  add constraint profiles_partner_ages_of_majority
  check (
    not is_couple
    or (
      coalesce((partner1 ->> 'age')::int, 18) >= 18
      and coalesce((partner2 ->> 'age')::int, 18) >= 18
    )
  );

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
