-- Group rooms are already PRO-only end to end (read + send policies both
-- require membership, which itself requires PRO), so photo messages don't
-- need their own PRO check the way direct messages do — anyone who can
-- post here already qualifies. `text` becomes nullable so a photo-only
-- message doesn't need an empty-string placeholder.
alter table public.group_room_messages add column media_url text;
alter table public.group_room_messages alter column text drop not null;
