import 'server-only';
import { readFile, stat, mkdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { developerSnapshotSchema } from '@/features/maya/development';
import { assertLocalDeveloper, type DeveloperIdentity } from './developer-auth';
import {
  atomicPrivateJson,
  withLeaseMutex,
  developmentRoot,
} from './development-files';

export const recoveryPolicy = {
  maximumLifetimeSeconds: 3600,
  safetyMarginSeconds: 600,
  source:
    'https://developers.openai.com/api/docs/guides/realtime-conversations',
} as const;
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const recoveryEvidenceSchema = z.strictObject({
  sessionId: z.uuid(),
  developerId: z.uuid(),
  approvalId: z.uuid(),
  journalSha256: digestSchema,
  callSha256: digestSchema,
  leaseSha256: digestSchema,
  leaseMtimeMs: z.number().nonnegative(),
  leaseInode: z.number().int().nonnegative(),
  connectionType: z.literal('realtime_webrtc'),
  ownerEvidence: z.literal('trusted_local_operator_review'),
  localCleanupConfirmedAt: z.iso.datetime(),
  localResourcesClosed: z.literal(true),
});
export const recoveryRequestSchema = z.strictObject({
  sessionId: z.uuid(),
  acknowledgeRemoteTerminationUnconfirmed: z.literal(true),
  confirmLocalResourcesClosed: z.literal(true),
});
const auditSchema = z.strictObject({
  sessionId: z.uuid(),
  developerId: z.uuid(),
  authorizedAt: z.iso.datetime(),
  status: z.literal('expired_by_policy_remote_termination_unconfirmed'),
  providerTerminationConfirmed: z.literal(false),
  acknowledgedRemoteUncertainty: z.literal(true),
  journalSha256: digestSchema,
  evidenceSha256: digestSchema,
  callSha256: digestSchema,
  creationUpperBound: z.iso.datetime(),
  recoverAfter: z.iso.datetime(),
  maximumLifetimeSeconds: z.literal(3600),
  safetyMarginSeconds: z.literal(600),
  policySource: z.literal(recoveryPolicy.source),
  leaseReleased: z.boolean(),
});
export type RecoveryAudit = z.infer<typeof auditSchema>;
const sha = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

async function readEvidence(
  root: string,
  id: string,
  identity: DeveloperIdentity,
) {
  const dir = join(root, '.local', 'maya');
  const evidenceRaw = await readFile(
    join(root, '.local', 'maya-recovery', `${id}.evidence.json`),
    'utf8',
  );
  const evidence = recoveryEvidenceSchema.parse(JSON.parse(evidenceRaw));
  if (evidence.sessionId !== id || evidence.developerId !== identity.userId)
    throw new Error('Recovery ownership evidence rejected.');
  const raw = await readFile(join(dir, `${id}.json`), 'utf8');
  const document = z
    .object({
      snapshot: developerSnapshotSchema,
      callId: z.string().regex(/^rtc_[A-Za-z0-9_-]+$/),
      owner: z
        .object({ developerId: z.uuid(), approvalId: z.uuid() })
        .optional(),
    })
    .parse(JSON.parse(raw));
  if (
    document.owner &&
    (document.owner.developerId !== identity.userId ||
      document.owner.approvalId !== evidence.approvalId)
  )
    throw new Error('Journal owner mismatch.');
  const snapshot = document.snapshot;
  if (
    snapshot.id !== id ||
    sha(raw) !== evidence.journalSha256 ||
    sha(document.callId) !== evidence.callSha256 ||
    snapshot.status !== 'abandoned' ||
    snapshot.metrics.terminationConfirmed
  )
    throw new Error('Unconfirmed failed-call evidence required.');
  const started = snapshot.events.find((e) => e.kind === 'started');
  const created =
    snapshot.events.find((e) => e.kind === 'call_created') ??
    snapshot.events.find((e) => e.kind === 'connected');
  if (
    !started ||
    !created ||
    started.payload.model !== 'gpt-realtime-2.1' ||
    Date.parse(created.createdAt) < Date.parse(started.createdAt) ||
    Date.parse(evidence.localCleanupConfirmedAt) < Date.parse(created.createdAt)
  )
    throw new Error('Verified provider creation upper bound required.');
  // The successful create return or later sideband-open timestamp is an upper bound,
  // never a browser expiry value. Missing creation evidence must not fabricate history.
  const creationUpperBound = created.createdAt;
  const recoverAfter = new Date(
    Date.parse(creationUpperBound) + 4200000,
  ).toISOString();
  await stat(join(dir, `approval-${evidence.approvalId}.used`));
  return {
    dir,
    evidence,
    evidenceHash: sha(evidenceRaw),
    creationUpperBound,
    recoverAfter,
  };
}
export async function inspectRecovery(
  origin: string,
  identity: DeveloperIdentity,
  id: string,
  root = developmentRoot(),
  now = Date.now(),
) {
  assertLocalDeveloper(origin, identity);
  z.uuid().parse(id);
  const e = await readEvidence(root, id, identity);
  let audit: RecoveryAudit | null = null;
  try {
    audit = auditSchema.parse(
      JSON.parse(
        await readFile(join(e.dir, 'recoveries', `${id}.json`), 'utf8'),
      ),
    );
    if (
      audit.developerId !== identity.userId ||
      audit.evidenceSha256 !== e.evidenceHash
    )
      throw new Error('Recovery audit mismatch.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return {
    sessionId: id,
    recoverAfter: e.recoverAfter,
    eligible:
      now >= Date.parse(e.recoverAfter) &&
      now >= Date.parse(e.evidence.localCleanupConfirmedAt),
    status: audit?.status ?? 'remote_termination_unconfirmed',
    leaseReleased: audit?.leaseReleased ?? false,
  };
}
export async function recoverExpiredIncident(
  origin: string,
  identity: DeveloperIdentity,
  raw: unknown,
  root = developmentRoot(),
  now = Date.now(),
) {
  assertLocalDeveloper(origin, identity);
  const request = recoveryRequestSchema.parse(raw);
  const dir = join(root, '.local', 'maya');
  return withLeaseMutex(dir, async () => {
    const e = await readEvidence(root, request.sessionId, identity);
    if (
      now < Date.parse(e.recoverAfter) ||
      now < Date.parse(e.evidence.localCleanupConfirmedAt)
    )
      throw new Error('Verified lifetime and safety margin have not elapsed.');
    const auditDir = join(dir, 'recoveries');
    await mkdir(auditDir, { recursive: true, mode: 0o700 });
    const auditPath = join(auditDir, `${request.sessionId}.json`);
    let audit: RecoveryAudit | null = null;
    try {
      audit = auditSchema.parse(JSON.parse(await readFile(auditPath, 'utf8')));
      if (
        audit.developerId !== identity.userId ||
        audit.evidenceSha256 !== e.evidenceHash ||
        audit.journalSha256 !== e.evidence.journalSha256
      )
        throw new Error('Recovery audit mismatch.');
      if (audit.leaseReleased) return audit;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const lease = join(dir, 'active.lock');
    try {
      const [bytes, info] = await Promise.all([readFile(lease), stat(lease)]);
      if (
        sha(bytes) !== e.evidence.leaseSha256 ||
        info.mtimeMs !== e.evidence.leaseMtimeMs ||
        info.ino !== e.evidence.leaseInode
      )
        throw new Error('The lease belongs to another operation.');
    } catch (error) {
      if (!audit || (error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error;
      // An audit was durably written before unlink; resume a crash after that unlink.
      audit.leaseReleased = true;
      await atomicPrivateJson(auditPath, audit);
      return audit;
    }
    audit ??= {
      sessionId: request.sessionId,
      developerId: identity.userId,
      authorizedAt: new Date(now).toISOString(),
      status: 'expired_by_policy_remote_termination_unconfirmed',
      providerTerminationConfirmed: false,
      acknowledgedRemoteUncertainty: true,
      journalSha256: e.evidence.journalSha256,
      evidenceSha256: e.evidenceHash,
      callSha256: e.evidence.callSha256,
      creationUpperBound: e.creationUpperBound,
      recoverAfter: e.recoverAfter,
      maximumLifetimeSeconds: 3600,
      safetyMarginSeconds: 600,
      policySource: recoveryPolicy.source,
      leaseReleased: false,
    };
    // Write history before altering the lease. Original incident and approval are untouched.
    await atomicPrivateJson(auditPath, audit);
    await unlink(lease);
    audit.leaseReleased = true;
    await atomicPrivateJson(auditPath, audit);
    return audit;
  });
}
