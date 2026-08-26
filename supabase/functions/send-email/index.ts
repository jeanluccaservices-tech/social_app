// Supabase "Send Email" auth hook handler.
//
// When this hook is enabled (Dashboard > Authentication > Hooks), Supabase
// stops sending auth e-mails itself and instead POSTs the payload here for
// every auth e-mail (signup confirmation, magic link, password recovery,
// e-mail change, invite). We build the e-mail ourselves and send it via
// Resend, always including the 6-digit `token` so the LoveVibe UI can drive
// a code-entry flow (supabase.auth.verifyOtp) instead of a magic link.
//
// Required secrets (set with `supabase secrets set`):
//   RESEND_API_KEY          - Resend API key
//   SEND_EMAIL_HOOK_SECRET  - the "v1,whsec_..." secret shown when the hook
//                              is enabled in the dashboard
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { Resend } from 'npm:resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string).replace('v1,whsec_', '');

const FROM_ADDRESS = 'LoveVibe <onboarding@resend.dev>';

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
};

const contentFor = (actionType: string, token: string) => {
  switch (actionType) {
    case 'signup':
      return {
        subject: 'Seu código de verificação - LoveVibe',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#e11d48;">Bem-vindo(a) ao LoveVibe 💕</h2>
            <p>Use o código abaixo para confirmar seu cadastro:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background:#fdf2f8; border-radius: 12px;">${token}</p>
            <p>O código expira em alguns minutos. Se você não criou uma conta no LoveVibe, ignore este e-mail.</p>
          </div>`,
      };
    case 'recovery':
      return {
        subject: 'Código para redefinir sua senha - LoveVibe',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#e11d48;">Redefinição de senha</h2>
            <p>Use o código abaixo para redefinir sua senha no LoveVibe:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background:#fdf2f8; border-radius: 12px;">${token}</p>
            <p>Se você não solicitou isso, ignore este e-mail.</p>
          </div>`,
      };
    default:
      return {
        subject: 'Seu código de verificação - LoveVibe',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <p>Use o código abaixo para continuar no LoveVibe:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background:#fdf2f8; border-radius: 12px;">${token}</p>
          </div>`,
      };
  }
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: EmailData;
    };

    const { subject, html } = contentFor(email_data.email_action_type, email_data.token);

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [user.email],
      subject,
      html,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(error);
    // IMPORTANT: GoTrue only reads this JSON `error` body when we respond
    // with 200 — any 4xx/5xx status here gets replaced with a generic,
    // unhelpful message on the client (e.g. a 401 always surfaces as "Hook
    // requires authorization token", regardless of what actually failed).
    return new Response(
      JSON.stringify({
        error: {
          http_code: error?.statusCode ?? error?.code ?? 500,
          message: error?.message ?? 'Failed to send e-mail',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
