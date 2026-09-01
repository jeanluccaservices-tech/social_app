// Shared rate-limit helper for Edge Functions. Backed by the
// `rate_limit_hits` table + `check_rate_limit()` RPC (see
// supabase/migrations/0028_rate_limiting.sql). Call this with a
// service-role client — the RPC is only granted to service_role.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const checkRateLimit = async (
  supabaseAdmin: SupabaseClient,
  bucketKey: string,
  maxHits: number,
  windowSeconds: number
): Promise<boolean> => {
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_bucket_key: bucketKey,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Fail open: a bug in the rate-limit check itself shouldn't take down
    // payments/reports/etc. Log it so it's visible in the function logs.
    console.error('checkRateLimit failed, allowing request through', error);
    return true;
  }

  return data === true;
};

// Identifies the caller for bucketing: the authenticated user when we have
// one, otherwise their IP (Supabase Edge Functions forward it via
// x-forwarded-for).
export const clientIdentity = (req: Request, userId?: string | null): string => {
  if (userId) return `user:${userId}`;
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
};
