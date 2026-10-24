import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  stat,
  rm,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
vi.mock('server-only', () => ({}));
vi.mock('@/server/supabase-session', () => ({ createSessionClient: vi.fn() }));
import {
  recoverExpiredIncident,
  inspectRecovery,
} from '@/server/maya/development-recovery';
const id = '65000000-0000-4000-8000-000000000001';
const owner = '65000000-0000-4000-8000-000000000002';
const approvalId = '65000000-0000-4000-8000-000000000003';
const identity = {
  userId: owner,
  authSessionId: '65000000-0000-4000-8000-000000000004',
};
const began = Date.parse('2026-10-12T16:00:00Z');
const after = began + 4200000;
const request = {
  sessionId: id,
  acknowledgeRemoteTerminationUnconfirmed: true,
  confirmLocalResourcesClosed: true,
};
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
let root: string, journal: string, evidencePath: string;
beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('MAYA_DEV_USER_IDS', owner);
  vi.stubEnv('MAYA_DEV_ORIGIN', 'http://localhost:3000');
  root = await mkdtemp(join(tmpdir(), 'maya-recovery-'));
  const dir = join(root, '.local', 'maya');
  await mkdir(dir, { recursive: true });
  await mkdir(join(root, '.local', 'maya-recovery'));
  const event = (kind: string, sequence: number) => ({
    id: `65000000-0000-4000-8000-00000000000${sequence + 5}`,
    lessonId: id,
    sequence,
    epoch: 0,
    protocolVersion: 1,
    source: 'maya_development',
    kind,
    payload:
      kind === 'started'
        ? { model: 'gpt-realtime-2.1' }
        : { stage: 'sideband_error' },
    createdAt: new Date(began).toISOString(),
  });
  const snapshot = {
    id,
    status: 'abandoned',
    epoch: 1,
    stopAt: began + 2000,
    events: [
      event('started', 1),
      event('connected', 2),
      event('provider_failure', 3),
    ],
    pending: null,
    metrics: {
      durationMs: 2000,
      firstAudioMs: null,
      boardLatencyMs: [],
      coordinationDelayMs: [],
      interruptionMs: [],
      responseLatencyMs: [],
      staleRejected: 0,
      failures: 1,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCents: 0,
      usageComplete: false,
      terminationConfirmed: false,
    },
  };
  journal = JSON.stringify({ snapshot, callId: 'rtc_test_retained' });
  await writeFile(join(dir, `${id}.json`), journal);
  await writeFile(join(dir, 'active.lock'), '');
  await writeFile(join(dir, `approval-${approvalId}.used`), '');
  const lease = await stat(join(dir, 'active.lock'));
  evidencePath = join(root, '.local', 'maya-recovery', `${id}.evidence.json`);
  await writeFile(
    evidencePath,
    JSON.stringify({
      sessionId: id,
      developerId: owner,
      approvalId,
      journalSha256: sha(journal),
      callSha256: sha('rtc_test_retained'),
      leaseSha256: sha(''),
      leaseMtimeMs: lease.mtimeMs,
      leaseInode: lease.ino,
      connectionType: 'realtime_webrtc',
      ownerEvidence: 'trusted_local_operator_review',
      localCleanupConfirmedAt: new Date(began + 3000).toISOString(),
      localResourcesClosed: true,
    }),
  );
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
it('denies premature recovery and preserves the lock', async () => {
  await expect(
    recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after - 1,
    ),
  ).rejects.toThrow('margin');
  expect(await readFile(join(root, '.local/maya/active.lock'), 'utf8')).toBe(
    '',
  );
});
it('recovers after the verified lifetime/margin without changing the failed journal or consumed approval', async () => {
  const audit = await recoverExpiredIncident(
    'http://localhost:3000',
    identity,
    request,
    root,
    after,
  );
  expect(audit.status).toBe('expired_by_policy_remote_termination_unconfirmed');
  expect(audit.providerTerminationConfirmed).toBe(false);
  expect(audit.leaseReleased).toBe(true);
  expect(audit.developerId).toBe(owner);
  expect(audit.authorizedAt).toBe(new Date(after).toISOString());
  expect(await readFile(join(root, '.local/maya', `${id}.json`), 'utf8')).toBe(
    journal,
  );
  await expect(
    stat(join(root, '.local/maya/active.lock')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  await stat(join(root, '.local/maya', `approval-${approvalId}.used`));
});
it('makes duplicate recovery idempotent without releasing a later lease', async () => {
  const first = await recoverExpiredIncident(
    'http://localhost:3000',
    identity,
    request,
    root,
    after,
  );
  await writeFile(join(root, '.local/maya/active.lock'), 'new-call-lease');
  expect(
    await recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after + 1000,
    ),
  ).toEqual(first);
  expect(await readFile(join(root, '.local/maya/active.lock'), 'utf8')).toBe(
    'new-call-lease',
  );
});
it('serializes competing requests and permits an exact retry of the busy request', async () => {
  const results = await Promise.allSettled([
    recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after,
    ),
    recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after,
    ),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    (
      await recoverExpiredIncident(
        'http://localhost:3000',
        identity,
        request,
        root,
        after,
      )
    ).leaseReleased,
  ).toBe(true);
});
it('rejects a different allowlisted developer and production/public origins', async () => {
  const other = '65000000-0000-4000-8000-000000000099';
  vi.stubEnv('MAYA_DEV_USER_IDS', `${owner},${other}`);
  await expect(
    recoverExpiredIncident(
      'http://localhost:3000',
      { ...identity, userId: other },
      request,
      root,
      after,
    ),
  ).rejects.toThrow('ownership');
  await expect(
    recoverExpiredIncident(
      'https://example.test',
      identity,
      request,
      root,
      after,
    ),
  ).rejects.toThrow('Local');
  vi.stubEnv('NODE_ENV', 'production');
  await expect(
    recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after,
    ),
  ).rejects.toThrow('Local');
});
it('rejects missing evidence, tampered history, missing acknowledgment and a changed lease', async () => {
  await expect(
    recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      { ...request, acknowledgeRemoteTerminationUnconfirmed: false },
      root,
      after,
    ),
  ).rejects.toThrow();
  await writeFile(join(root, '.local/maya/active.lock'), 'another-call');
  await expect(
    recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after,
    ),
  ).rejects.toThrow('lease');
  await writeFile(join(root, '.local/maya', `${id}.json`), journal + ' ');
  await expect(
    inspectRecovery('http://localhost:3000', identity, id, root, after),
  ).rejects.toThrow('evidence');
  await rm(evidencePath);
  await expect(
    recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after,
    ),
  ).rejects.toThrow();
});
it('denies missing creation evidence and a future cleanup attestation', async () => {
  const doc = JSON.parse(journal);
  doc.snapshot.events = doc.snapshot.events.filter(
    (e: { kind: string }) => e.kind !== 'connected',
  );
  const raw = JSON.stringify(doc);
  await writeFile(join(root, '.local/maya', `${id}.json`), raw);
  const e = JSON.parse(await readFile(evidencePath, 'utf8'));
  e.journalSha256 = sha(raw);
  await writeFile(evidencePath, JSON.stringify(e));
  await expect(
    recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after,
    ),
  ).rejects.toThrow('upper bound');
  await writeFile(join(root, '.local/maya', `${id}.json`), journal);
  e.journalSha256 = sha(journal);
  e.localCleanupConfirmedAt = new Date(after + 1).toISOString();
  await writeFile(evidencePath, JSON.stringify(e));
  await expect(
    recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after,
    ),
  ).rejects.toThrow('margin');
});
it('is provider independent and inspection never releases the lease', async () => {
  const network = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('No network permitted'));
  try {
    expect(
      (
        await inspectRecovery(
          'http://localhost:3000',
          identity,
          id,
          root,
          after,
        )
      ).eligible,
    ).toBe(true);
    await stat(join(root, '.local/maya/active.lock'));
    await recoverExpiredIncident(
      'http://localhost:3000',
      identity,
      request,
      root,
      after,
    );
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});
