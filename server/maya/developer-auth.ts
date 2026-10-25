import 'server-only';
import { z } from 'zod';
import { createSessionClient } from '@/server/supabase-session';

export const approvalSchema = z.strictObject({
  approvalId: z.uuid(),
  developerId: z.uuid(),
  fixture: z.literal('grade8-adult-v2'),
  model: z.enum(['gpt-realtime-2.1', 'gpt-live-1']),
  backendModel: z.literal('gpt-5.6-terra').optional(),
  expiresAt: z.iso.datetime(),
  durationSeconds: z.number().int().min(15).max(300),
  budgetCents: z.number().int().min(1).max(200),
  acceptUncappedProviderRisk: z.literal(true),
  maxSessions: z.literal(1),
});
export type DeveloperIdentity = { userId: string; authSessionId: string };
export function assertLocalDeveloper(
  origin: string,
  identity: DeveloperIdentity,
  env: Record<string, string | undefined> = process.env,
) {
  const configured = new URL(env.MAYA_DEV_ORIGIN ?? 'http://localhost:3000');
  if (
    env.NODE_ENV !== 'development' ||
    configured.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(configured.hostname) ||
    configured.origin !== origin
  )
    throw new Error('Local development access required.');
  z.uuid().parse(identity.authSessionId);
  const ids = (env.MAYA_DEV_USER_IDS ?? '')
    .split(',')
    .filter(Boolean)
    .map((id) => z.uuid().parse(id.trim()));
  if (!ids.includes(z.uuid().parse(identity.userId)))
    throw new Error(
      'Developer identity is not allowlisted by the local operator.',
    );
}
export function liveApproval(
  identity: DeveloperIdentity,
  env: Record<string, string | undefined> = process.env,
  now = Date.now(),
) {
  if (env.MAYA_DEV_ENABLED !== '1')
    throw new Error('Live developer mode disabled.');
  const approval = approvalSchema.parse(
    JSON.parse(env.MAYA_DEV_APPROVAL ?? '{}'),
  );
  if (
    approval.model !== 'gpt-live-1' ||
    approval.backendModel !== 'gpt-5.6-terra' ||
    approval.developerId !== identity.userId ||
    Date.parse(approval.expiresAt) <= now ||
    Date.parse(approval.expiresAt) > now + 3600000
  )
    throw new Error('A current scoped founder approval is required.');
  if (env.MAYA_DEV_MODEL && env.MAYA_DEV_MODEL !== approval.model)
    throw new Error('Model differs from the approved configuration.');
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.startsWith('replace-'))
    throw new Error('Server-only API credentials missing.');
  return approval;
}
export async function authorizeDeveloper(origin: string) {
  // Reject nonlocal/production before any authentication network work.
  if (process.env.NODE_ENV !== 'development')
    throw new Error('Development only.');
  const client = await createSessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at)
    throw new Error('Verified developer authentication required.');
  const claims = await client.auth.getClaims();
  const identity = {
    userId: user.id,
    authSessionId: z.uuid().parse(claims.data?.claims.session_id),
  };
  if (claims.error || claims.data?.claims.sub !== user.id)
    throw new Error('Verified Auth session required.');
  assertLocalDeveloper(origin, identity);
  const retained = await client.rpc('is_current_auth_session_active');
  if (retained.error || retained.data !== true)
    throw new Error('Current retained Auth session required.');
  const preview = await client.rpc('active_preview_student');
  if (preview.error || preview.data)
    throw new Error('Supervised preview cannot enter developer AI.');
  return identity;
}
