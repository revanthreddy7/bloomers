import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSessionClient } from '@/server/supabase-session';
import { requirePreview } from '@/server/application/preview';
import { endPreview } from '@/server/application/actions';
export default async function ReturnToParent() {
  const client = await createSessionClient();
  const { data, error } = await client.rpc('active_preview_student');
  if (error) redirect('/auth/sign-in');
  if (!data) redirect('/parent');
  await requirePreview(data);
  return (
    <main className="narrow">
      <div className="eyebrow">PARENT-ASSISTED PREVIEW</div>
      <h1>Return to parent mode?</h1>
      <section className="panel">
        <p>
          A parent should continue from here. Parent mode restores access to
          student selection, account settings and permissions.
        </p>
        <form action={endPreview}>
          <button>I’m the parent — continue</button>
        </form>
        <p>
          <Link href={`/preview/${data}`}>Stay in student preview</Link>
        </p>
        <p className="small">
          This supervised preview is not a secure unattended device handoff or
          an independent student account.
        </p>
      </section>
    </main>
  );
}
