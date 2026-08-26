-- Sending photos in direct messages is a PRO-only perk — enforce it here
-- too, not just in the UI, since a non-PRO reply-sender could otherwise
-- attach media_url directly through the API.
drop policy "PRO members can send messages, others can reply to PRO senders" on public.messages;
create policy "PRO members can send messages, others can reply to PRO senders"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and (
      sender_id = receiver_id
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_pro)
      or exists (
        select 1 from public.messages m
        where m.sender_id = receiver_id and m.receiver_id = auth.uid()
      )
    )
    and (
      media_url is null
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_pro)
    )
  );
