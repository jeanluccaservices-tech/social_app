// Records a post report (same row the old direct `post_reports` insert
// created) and e-mails a moderation notification with the report reason,
// the reporter's details, the reported post's content/media, and a direct
// link to it — so a report doesn't just sit in the database waiting to be
// noticed.
//
// Runs the insert AND the e-mail from here (instead of the client
// inserting directly) so the notification can't be skipped and so it can
// read the post's content/author with the service role, regardless of the
// reporter's own read access.
//
// Required secrets (set with `supabase secrets set`):
//   RESEND_API_KEY   - Resend API key (same one send-email uses)
//   SITE_URL         - the deployed app's URL, used to build the post link
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend';
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

const FROM_ADDRESS = 'LoveVibe <noreply@lovevibe.com.br>';
const REPORT_TO_EMAIL = 'denuncias@lovevibe.com.br';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

  const withinLimit = await checkRateLimit(supabaseAdmin, `report-post:${clientIdentity(req, user.id)}`, 10, 3600);
  if (!withinLimit) {
    return jsonResponse({ error: 'Muitas denúncias em pouco tempo. Aguarde um pouco e tente novamente.' }, 429);
  }

  const { post_id: postId, reason, details } = await req.json().catch(() => ({}));
  if (!postId || !reason) {
    return jsonResponse({ error: 'post_id e reason são obrigatórios.' }, 400);
  }

  const { error: insertError } = await supabaseAdmin
    .from('post_reports')
    .insert({ post_id: postId, reporter_id: user.id, reason, details: details || null });

  if (insertError) {
    if (insertError.code === '23505') {
      return jsonResponse({ error: 'Você já denunciou esta publicação.' }, 409);
    }
    console.error(insertError);
    return jsonResponse({ error: 'Não foi possível enviar a denúncia.' }, 500);
  }

  // The e-mail is best-effort: the report itself is already saved above,
  // so a Resend hiccup here shouldn't turn into a "failed" response for
  // the person reporting.
  try {
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id, content, media_url, created_at, user_id, author:profiles!posts_user_id_fkey ( name, username )')
      .eq('id', postId)
      .maybeSingle();

    const { data: reporterProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, username')
      .eq('id', user.id)
      .maybeSingle();

    // profiles has no e-mail column — it lives on auth.users, so fetch the
    // author's separately (the reporter's is already on the JWT above).
    const authorEmail = post?.user_id
      ? (await supabaseAdmin.auth.admin.getUserById(post.user_id)).data?.user?.email ?? null
      : null;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const siteUrl = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
      const postLink = siteUrl ? `${siteUrl}/?postId=${postId}` : null;

      const html = `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color:#e11d48;">Nova denúncia de publicação — LoveVibe</h2>
          <table style="width:100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding:6px 0; color:#666;">Motivo</td><td style="padding:6px 0; font-weight:bold;">${escapeHtml(reason)}</td></tr>
            ${details ? `<tr><td style="padding:6px 0; color:#666; vertical-align:top;">Detalhes</td><td style="padding:6px 0;">${escapeHtml(details)}</td></tr>` : ''}
            <tr><td style="padding:6px 0; color:#666;">Denunciado por</td><td style="padding:6px 0;">${escapeHtml(reporterProfile?.name || 'Usuário')} (@${escapeHtml(reporterProfile?.username || '—')}) — ${escapeHtml(user.email || '—')}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">Autor da publicação</td><td style="padding:6px 0;">${escapeHtml(post?.author?.name || 'Usuário')} (@${escapeHtml(post?.author?.username || '—')}) — ${escapeHtml(authorEmail || '—')}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">Publicada em</td><td style="padding:6px 0;">${post?.created_at ? new Date(post.created_at).toLocaleString('pt-BR') : '—'}</td></tr>
            <tr><td style="padding:6px 0; color:#666;">ID da publicação</td><td style="padding:6px 0; font-family: monospace;">${escapeHtml(postId)}</td></tr>
            ${postLink ? `<tr><td style="padding:6px 0; color:#666;">Link</td><td style="padding:6px 0;"><a href="${postLink}">${postLink}</a></td></tr>` : ''}
          </table>
          <div style="margin-top:16px; padding:12px 16px; background:#fdf2f8; border-radius:12px;">
            <p style="margin:0 0 4px; color:#666; font-size:12px;">Conteúdo da publicação:</p>
            <p style="margin:0; white-space:pre-line;">${post?.content ? escapeHtml(post.content) : '<em>(sem texto)</em>'}</p>
            ${post?.media_url ? `<p style="margin:8px 0 0;"><a href="${post.media_url}">Ver mídia anexada</a></p>` : ''}
          </div>
        </div>`;

      const { error: emailError } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: [REPORT_TO_EMAIL],
        subject: `Denúncia: ${reason}`,
        html,
      });
      if (emailError) console.error('report-post: resend error', emailError);
    } else {
      console.warn('report-post: RESEND_API_KEY not set, skipping notification e-mail');
    }
  } catch (err) {
    console.error('report-post: notification e-mail failed', err);
  }

  return jsonResponse({ ok: true }, 200);
});
