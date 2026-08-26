-- Soft-deleting posts/comments via a direct table UPDATE + RLS policy was
-- unreliable to verify. Switch to SECURITY DEFINER RPC functions that do
-- the ownership check explicitly in the function body — this sidesteps
-- any RLS UPDATE-policy edge case entirely and is the standard Supabase
-- pattern for "only the owner can do X" writes that aren't plain CRUD.
drop policy if exists "Users can soft-delete their own posts" on public.posts;
drop policy if exists "Users can soft-delete their own comments" on public.comments;

create or replace function public.soft_delete_post(target_post_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.posts
  set deleted_at = now()
  where id = target_post_id and user_id = auth.uid();
end;
$$;

grant execute on function public.soft_delete_post(uuid) to authenticated;

create or replace function public.soft_delete_comment(target_comment_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.comments
  set deleted_at = now()
  where id = target_comment_id and user_id = auth.uid();
end;
$$;

grant execute on function public.soft_delete_comment(uuid) to authenticated;
