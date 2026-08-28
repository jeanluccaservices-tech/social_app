-- Lets a recipient mark their own received messages as read, so the client
-- can show an unread-message indicator. Only `read_at` may ever change on
-- an existing row — a trigger blocks tampering with anything else (sender,
-- receiver, text, media, timestamp) via the new UPDATE policy below.
alter table public.messages add column read_at timestamptz;

create or replace function public.prevent_message_content_edit()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.text is distinct from old.text
     or new.media_url is distinct from old.media_url
     or new.created_at is distinct from old.created_at then
    raise exception 'messages: only read_at can be updated';
  end if;
  return new;
end;
$$;

create trigger messages_restrict_update
  before update on public.messages
  for each row execute function public.prevent_message_content_edit();

create policy "Receiver can mark their messages read"
  on public.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);
