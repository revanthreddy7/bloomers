import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, mkdtemp, stat, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Local fixtures only.');
try {
  await fetch('http://localhost:3000', { signal: AbortSignal.timeout(1000) });
  throw new Error('Stop the existing app server before developer validation.');
} catch (error) {
  if (error.message.startsWith('Stop the existing')) throw error;
}
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const email = `maya-adult-fixture-${randomUUID()}@example.test`,
  password = `Local-${randomUUID()}!`;
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error || !data.user)
  throw new Error(
    'Could not create guarded local synthetic developer fixture.',
  );
const fixtureFile = '.local/maya-developer-browser.json';
let server;
const recoveryRoot = await mkdtemp(join(tmpdir(), 'maya-browser-recovery-'));
const recoveryId = randomUUID();
try {
  await mkdir('.local', { recursive: true, mode: 0o700 });
  const dir = join(recoveryRoot, '.local', 'maya');
  await mkdir(dir, { recursive: true });
  await mkdir(join(recoveryRoot, '.local', 'maya-recovery'));
  const approvalId = randomUUID(),
    createdAt = new Date(Date.now() - 90 * 60000).toISOString();
  const event = (kind, sequence) => ({
    id: randomUUID(),
    lessonId: recoveryId,
    sequence,
    epoch: 0,
    protocolVersion: 1,
    source: 'maya_development',
    kind,
    payload: kind === 'started' ? { model: 'gpt-realtime-2.1' } : {},
    createdAt,
  });
  const snapshot = {
    id: recoveryId,
    status: 'abandoned',
    epoch: 1,
    stopAt: Date.parse(createdAt) + 2000,
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
  const journal = JSON.stringify({
    snapshot,
    callId: 'rtc_synthetic_browser_never_transmitted',
  });
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  await writeFile(join(dir, recoveryId + '.json'), journal);
  await writeFile(join(dir, 'active.lock'), '');
  await writeFile(join(dir, 'approval-' + approvalId + '.used'), '');
  const lease = await stat(join(dir, 'active.lock'));
  await writeFile(
    join(
      recoveryRoot,
      '.local',
      'maya-recovery',
      recoveryId + '.evidence.json',
    ),
    JSON.stringify({
      sessionId: recoveryId,
      developerId: data.user.id,
      approvalId,
      journalSha256: sha(journal),
      callSha256: sha('rtc_synthetic_browser_never_transmitted'),
      leaseSha256: sha(''),
      leaseMtimeMs: lease.mtimeMs,
      leaseInode: lease.ino,
      connectionType: 'realtime_webrtc',
      ownerEvidence: 'trusted_local_operator_review',
      localCleanupConfirmedAt: new Date(
        Date.parse(createdAt) + 3000,
      ).toISOString(),
      localResourcesClosed: true,
    }),
  );
  await writeFile(
    fixtureFile,
    JSON.stringify({ email, password, id: data.user.id, recoveryId }),
    { mode: 0o600 },
  );
  const env = {
    ...process.env,
    MAYA_DEV_USER_IDS: data.user.id,
    MAYA_DEV_ENABLED: '0',
    MAYA_DEV_APPROVAL: '',
    MAYA_DEV_ORIGIN: 'http://localhost:3000',
    MAYA_DEV_BROWSER_FIXTURE: fixtureFile,
    MAYA_DEV_STORAGE_ROOT: recoveryRoot,
    MAYA_DEV_RECOVERY_SESSION_ID: recoveryId,
  };
  server = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1'], {
    env,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  const started = Date.now();
  let ready = false;
  while (Date.now() - started < 45000) {
    try {
      if (
        (
          await fetch('http://localhost:3000', {
            signal: AbortSignal.timeout(2000),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {
      /* wait for local startup */
    }
    if (server.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Developer validation server did not start.');
  const test = spawn(
    'npm',
    ['run', 'test:e2e', '--', 'tests/e2e/maya-development.spec.ts'],
    { env, stdio: 'inherit' },
  );
  const [code] = await once(test, 'exit');
  if (code !== 0) process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    process.kill(-server.pid, 'SIGTERM');
    await Promise.race([
      once(server, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  await admin.auth.admin.deleteUser(data.user.id);
  await unlink(fixtureFile).catch(() => {});
  await rm(recoveryRoot, { recursive: true, force: true });
}
