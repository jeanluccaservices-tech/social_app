-- Companion to 0004: that migration backfilled the old stock cover photo
-- to null but missed the old stock avatar photo (avatar_url had no
-- coalesce default in the trigger, it came from the client's now-removed
-- DEFAULT_AVATAR/DEFAULT_COUPLE_AVATAR constants instead).
update public.profiles
set avatar_url = null
where avatar_url in (
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?auto=format&fit=crop&w=500&q=80'
);
