-- Replaces the original seeded group rooms with the themed set requested
-- by the site owner, and adds a 'trans_only' eligibility rule alongside
-- the existing couples/singles/location ones.
--
-- Deleting the old rooms cascades to group_room_members and
-- group_room_messages (both reference group_rooms with "on delete
-- cascade") — this intentionally discards the old rooms' membership and
-- chat history along with them, per the site owner's explicit
-- confirmation that the old rooms should be replaced, not kept alongside
-- the new ones.

alter table public.group_rooms
  drop constraint if exists group_rooms_rule_type_check,
  add constraint group_rooms_rule_type_check
    check (rule_type in ('none', 'couples_only', 'singles_only', 'trans_only', 'location'));

drop policy "PRO members can join rooms they're eligible for" on public.group_room_members;
create policy "PRO members can join rooms they're eligible for"
  on public.group_room_members for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.pro_expires_at > now())
    and exists (
      select 1 from public.group_rooms r
      where r.id = room_id
      and (
        r.rule_type = 'none'
        or (r.rule_type = 'couples_only' and exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.is_couple
        ))
        or (r.rule_type = 'singles_only' and exists (
          select 1 from public.profiles p where p.id = auth.uid() and not p.is_couple
        ))
        or (r.rule_type = 'trans_only' and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and not p.is_couple
          and p.gender in ('Mulher Trans', 'Homem Trans', 'Travesti', 'Crossdressing (CD)')
        ))
        or (r.rule_type = 'location' and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.location ilike '%' || r.rule_value || '%'
        ))
      )
    )
  );

delete from public.group_rooms;

insert into public.group_rooms (slug, name, description, icon_key, color, rule_type) values
  ('couples', 'Casais', 'Espaço reservado só para casais trocarem experiências, dicas e vivências a dois.', 'HeartHandshake', 'from-[#ff4b72] to-[#d91b5c]', 'couples_only'),
  ('trans', 'Trans', 'Espaço exclusivo para pessoas trans e travestis se conectarem com liberdade.', 'Transgender', 'from-sky-500 to-pink-500', 'trans_only'),
  ('couples_singles', 'Casais & Solteiros', 'Interação livre entre casais e solteiros — o clássico encontro a três.', 'Users2', 'from-fuchsia-600 to-purple-600', 'none'),
  ('general', 'Geral', 'Bate-papo aberto pra qualquer membro PRÓ, sem tema fixo.', 'MessageCircle', 'from-teal-500 to-cyan-600', 'none'),
  ('exhibitionism', 'Exibicionismo', 'Para quem gosta de se exibir e ser admirado(a) pela comunidade.', 'Eye', 'from-red-600 to-orange-600', 'none'),
  ('photo_exchange', 'Troca de Fotos', 'Compartilhamento de fotos picantes entre membros do grupo.', 'Images', 'from-indigo-600 to-blue-600', 'none'),
  ('fetishes', 'Fetiches & Fantasias', 'Converse sobre fetiches, fantasias e curiosidades sem julgamento.', 'Drama', 'from-violet-600 to-fuchsia-700', 'none'),
  ('menage', 'Ménage & Trisal', 'Espaço para quem busca ou já vive experiências a três.', 'UsersRound', 'from-rose-600 to-red-700', 'none'),
  ('first_time', 'Primeira Vez', 'Pra quem é novo no meio e quer tirar dúvidas antes de participar de algo.', 'Compass', 'from-emerald-500 to-teal-600', 'none'),
  ('lgbtq', 'Diversidade LGBTQ+', 'Espaço acolhedor pra toda a comunidade LGBTQ+ do LoveVibe.', 'Star', 'from-fuchsia-500 via-purple-500 to-indigo-500', 'none');
