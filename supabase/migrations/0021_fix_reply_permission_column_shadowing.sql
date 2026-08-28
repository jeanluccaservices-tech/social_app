-- The "others can reply to PRO senders" clause added in 0018 never actually
-- worked: inside the correlated subquery `from public.messages m`, the bare
-- `receiver_id` in `m.sender_id = receiver_id` resolves to the subquery's
-- own `m.receiver_id` (Postgres binds an unqualified column to the
-- innermost FROM that has it), not to the new row being inserted. So the
-- clause collapsed to "m.sender_id = m.receiver_id and m.receiver_id =
-- auth.uid()" — checking for a self-message received by you, which is
-- already covered by the `sender_id = receiver_id` branch and otherwise
-- never true. Net effect: only currently-PRO senders could insert a row at
-- all, so a non-PRO user replying to someone who'd messaged them first got
-- a 403. Qualify with the table name (`messages.receiver_id`) to reference
-- the row being inserted instead of the subquery alias.
drop policy "PRO members can send messages, others can reply to PRO senders" on public.messages;
create policy "PRO members can send messages, others can reply to PRO senders"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and (
      sender_id = receiver_id
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.pro_expires_at > now())
      or exists (
        select 1 from public.messages m
        where m.sender_id = messages.receiver_id and m.receiver_id = auth.uid()
      )
    )
    and (
      media_url is null
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.pro_expires_at > now())
    )
  );
