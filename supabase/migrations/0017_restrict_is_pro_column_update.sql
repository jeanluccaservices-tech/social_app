-- Now that PRO is meant to be granted only by a real Mercado Pago payment
-- (via the mp-webhook Edge Function, which uses the service role and
-- bypasses RLS entirely), a regular user must not be able to set their own
-- is_pro to true through a direct profiles update — which the previous
-- row-only "own profile" policy allowed for every column, including this
-- one. Row Level Security is row-scoped, not column-scoped, so this needs
-- an explicit column-privilege restriction.
revoke update on public.profiles from authenticated, anon;

grant update (
  name, avatar_url, cover_url, bio, location, birth_date,
  pref_age_min, pref_age_max, pref_genders, pref_radius_km,
  height_cm, weight_kg, smokes, drinks, sexual_orientation, marital_status,
  partner1, partner2
) on public.profiles to authenticated;

-- is_pro, username, gender, id, age_confirmed, terms_accepted_at and
-- created_at are intentionally excluded — not updatable by the user at all.
