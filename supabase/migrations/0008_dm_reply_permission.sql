-- Non-PRO members still can't start a new DM thread, but can now reply if
-- a PRO member messaged them first.
drop policy "PRO members can send messages" on public.messages;
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
  );
