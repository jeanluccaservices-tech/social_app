// Soft-deletes a post (same as the old `soft_delete_post` RPC: the row
// stays, `deleted_at` is set, RLS hides it from every future read) and, if
// the post had an image, moves that file in Storage into a `deleted/`
// prefix inside the same bucket instead of leaving it mixed in with active
// media. That split is purely for manual moderation/audit browsing in the
// Supabase dashboard — the app itself never reads from `deleted/`.
//
// Needs the service role key because moving a file out of the owner's
// `${userId}/...` folder into `deleted/${userId}/...` fails the regular
// "manage your own media folder" storage policies, which only allow
// writes whose first path segment is the caller's own uid.
//
// Admins (is_admin(), checked server-side) may delete anyone's post, not
// just their own — used from the Admin panel to act on reported content.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkRateLimit, clientIdentity } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Public URLs look like ".../storage/v1/object/public/{bucket}/{path}".
const parsePublicUrl = (url: string): { bucket: string; path: string } | null => {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  const authedClient = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_ANON_KEY') as string,
    { global: { headers: { Authorization: authHeader ?? '' } } }
  );

  const {
    data: { user },
  } = await authedClient.auth.getUser();

  if (!user) {
    return jsonResponse({ error: 'Não autenticado.' }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') as string,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
  );

  const withinLimit = await checkRateLimit(supabaseAdmin, `delete-post:${clientIdentity(req, user.id)}`, 20, 3600);
  if (!withinLimit) {
    return jsonResponse({ error: 'Muitas exclusões em pouco tempo. Aguarde um pouco e tente novamente.' }, 429);
  }

  const { post_id: postId } = await req.json().catch(() => ({}));
  if (!postId) {
    return jsonResponse({ error: 'post_id é obrigatório.' }, 400);
  }

  const { data: isAdmin } = await authedClient.rpc('is_admin');

  // Ownership + "not already deleted" check happens server-side here, same
  // guarantee the old SECURITY DEFINER RPC gave — unless the caller is an
  // admin, who may delete any post.
  let deleteQuery = supabaseAdmin
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId)
    .is('deleted_at', null);
  if (!isAdmin) {
    deleteQuery = deleteQuery.eq('user_id', user.id);
  }
  const { data: post, error: updateError } = await deleteQuery.select('media_url').maybeSingle();

  if (updateError) {
    console.error(updateError);
    return jsonResponse({ error: 'Não foi possível excluir a publicação.' }, 500);
  }
  if (!post) {
    return jsonResponse({ error: 'Publicação não encontrada ou já excluída.' }, 404);
  }

  if (post.media_url) {
    const parsed = parsePublicUrl(post.media_url);
    if (parsed && !parsed.path.startsWith('deleted/')) {
      const deletedPath = `deleted/${parsed.path}`;
      const { error: moveError } = await supabaseAdmin.storage
        .from(parsed.bucket)
        .move(parsed.path, deletedPath);
      // The post is already hidden either way (that's what matters for
      // every other user) — a storage move hiccup just means this one
      // file stays put for manual cleanup, so it's logged, not thrown.
      if (moveError) {
        console.error('delete-post: storage move failed', moveError);
      } else {
        const { data: publicUrlData } = supabaseAdmin.storage.from(parsed.bucket).getPublicUrl(deletedPath);
        await supabaseAdmin.from('posts').update({ media_url: publicUrlData.publicUrl }).eq('id', postId);
      }
    }
  }

  return jsonResponse({ ok: true }, 200);
});
