import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { authorizeDeveloper, liveApproval } from '@/server/maya/developer-auth';
import { DevelopmentRoom } from '@/components/maya/development-room';
import { RecoveryControl } from '@/components/maya/recovery-control';
import { inspectRecovery } from '@/server/maya/development-recovery';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { developmentRoot } from '@/server/maya/development-files';
export const dynamic = 'force-dynamic';
export default async function DeveloperMayaPage() {
  try {
    const store = await headers(),
      origin = process.env.MAYA_DEV_ORIGIN ?? 'http://localhost:3000';
    if (store.get('host') !== new URL(origin).host) notFound();
    const identity = await authorizeDeveloper(origin);
    let ready = false;
    let blockedReason =
      'Live testing is off. A fresh approval for GPT-Live and its backend is required.';
    try {
      const approval = liveApproval(identity);
      ready = true;
      for (const file of [
        'active.lock',
        `approval-${approval.approvalId}.used`,
      ]) {
        try {
          await stat(join(developmentRoot(), '.local', 'maya', file));
          ready = false;
          blockedReason =
            file === 'active.lock'
              ? 'A previous session still holds the safety lock. Complete confirmed cleanup or audited recovery before starting.'
              : 'This approval has already been used. A new test needs fresh founder approval.';
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
    } catch {
      ready = false; // No billable request; file/approval failures remain closed.
    }
    let recovery = null;
    if (process.env.MAYA_DEV_RECOVERY_SESSION_ID) {
      try {
        recovery = await inspectRecovery(
          origin,
          identity,
          process.env.MAYA_DEV_RECOVERY_SESSION_ID,
        );
      } catch {
        /* Missing/foreign evidence must never permit recovery. */
      }
    }
    return (
      <>
        {recovery && <RecoveryControl incident={recovery} />}
        <DevelopmentRoom ready={ready} blockedReason={blockedReason} />
      </>
    );
  } catch {
    notFound();
  }
}
