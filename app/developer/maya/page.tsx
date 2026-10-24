import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { authorizeDeveloper, liveApproval } from '@/server/maya/developer-auth';
import { DevelopmentRoom } from '@/components/maya/development-room';
import { RecoveryControl } from '@/components/maya/recovery-control';
import { inspectRecovery } from '@/server/maya/development-recovery';
export const dynamic = 'force-dynamic';
export default async function DeveloperMayaPage() {
  try {
    const store = await headers(),
      origin = process.env.MAYA_DEV_ORIGIN ?? 'http://localhost:3000';
    if (store.get('host') !== new URL(origin).host) notFound();
    const identity = await authorizeDeveloper(origin);
    let ready = false;
    try {
      liveApproval(identity);
      ready = true;
    } catch {
      /* No billable request. */
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
        <DevelopmentRoom ready={ready} />
      </>
    );
  } catch {
    notFound();
  }
}
