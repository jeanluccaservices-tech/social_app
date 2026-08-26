-- Remove the scratch post row created while reproducing the soft-delete bug.
delete from public.posts where id = 'e0bb0c13-7674-4d5f-a212-6b442ef84c67';
