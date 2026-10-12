import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { authorizeDeveloper, liveApproval } from '@/server/maya/developer-auth';
import { DevelopmentRoom } from '@/components/maya/development-room';
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
    return <DevelopmentRoom ready={ready} />;
  } catch {
    notFound();
  }
}
