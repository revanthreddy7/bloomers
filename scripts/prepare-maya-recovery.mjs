import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import nextEnv from '@next/env';
import { z } from 'zod';
nextEnv.loadEnvConfig(process.cwd(), true);
const [id, developerId, ...flags] = process.argv.slice(2);
z.uuid().parse(id);
z.uuid().parse(developerId);
if (
  !flags.includes('--review-owner') ||
  !flags.includes('--acknowledge-local-cleanup')
)
  throw new Error(
    'Explicit operator owner review and local cleanup acknowledgment required.',
  );
if (
  process.env.MAYA_DEV_ENABLED === '1' ||
  !(process.env.MAYA_DEV_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .includes(developerId)
)
  throw new Error(
    'Disable live testing and verify the operator allowlist first.',
  );
const root = process.env.MAYA_DEV_STORAGE_ROOT ?? process.cwd();
const dir = join(root, '.local', 'maya');
const raw = await readFile(join(dir, `${id}.json`), 'utf8');
const incident = JSON.parse(raw);
if (
  incident.snapshot?.id !== id ||
  incident.snapshot.status !== 'abandoned' ||
  incident.snapshot.metrics.terminationConfirmed ||
  !/^rtc_[A-Za-z0-9_-]+$/.test(incident.callId)
)
  throw new Error('Known unconfirmed failed call required.');
let approvalId = incident.owner?.approvalId;
if (incident.owner) {
  if (incident.owner.developerId !== developerId)
    throw new Error('Journal owner mismatch.');
} else {
  // Legacy ownership is an explicit local-operator attestation, not a browser claim.
  const approval = JSON.parse(
    await readFile(join(root, '.local', 'maya-approved-smoke.json'), 'utf8'),
  );
  const started = incident.snapshot.events.find((e) => e.kind === 'started');
  if (
    approval.developerId !== developerId ||
    approval.model !== started?.payload.model ||
    approval.fixture !== started?.payload.fixture ||
    approval.budgetCents !== started?.payload.approvedBudgetCents
  )
    throw new Error('Legacy approval scope mismatch.');
  approvalId = approval.approvalId;
}
z.uuid().parse(approvalId);
await stat(join(dir, `approval-${approvalId}.used`));
const created =
  incident.snapshot.events.find((e) => e.kind === 'call_created') ??
  incident.snapshot.events.find((e) => e.kind === 'connected');
if (!created || !Number.isFinite(Date.parse(created.createdAt)))
  throw new Error('No server creation upper bound.');
const lease = await stat(join(dir, 'active.lock'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const evidence = {
  sessionId: id,
  developerId,
  approvalId,
  journalSha256: sha(raw),
  callSha256: sha(incident.callId),
  leaseSha256: sha(await readFile(join(dir, 'active.lock'))),
  leaseMtimeMs: lease.mtimeMs,
  leaseInode: lease.ino,
  connectionType: 'realtime_webrtc',
  ownerEvidence: 'trusted_local_operator_review',
  localCleanupConfirmedAt: new Date().toISOString(),
  localResourcesClosed: true,
};
const evidenceDir = join(root, '.local', 'maya-recovery');
await mkdir(evidenceDir, { recursive: true, mode: 0o700 });
await writeFile(
  join(evidenceDir, `${id}.evidence.json`),
  JSON.stringify(evidence, null, 2) + '\n',
  { flag: 'wx', mode: 0o600 },
);
console.log(
  JSON.stringify({
    evidencePrepared: true,
    leaseReleased: false,
    remoteTerminationConfirmed: false,
    recoverAfter: new Date(
      Date.parse(created.createdAt) + 4200000,
    ).toISOString(),
  }),
);
