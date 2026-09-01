-- Online/offline status: derived from a heartbeat timestamp the client
-- updates periodically while the app is open (see AuthContext.jsx), rather
-- than a full realtime presence system — consistent with the light-polling
-- pattern already used for contacts/notifications elsewhere in the app.
alter table public.profiles add column last_seen_at timestamptz;

-- Column-level grants are additive (0017_restrict_is_pro_column_update.sql
-- already locked down every other column), so this just adds the one new
-- column to what a logged-in user may update on their own row.
grant update (last_seen_at) on public.profiles to authenticated;
