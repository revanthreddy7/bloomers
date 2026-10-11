import Link from 'next/link';
import { requireParent } from '@/server/identity/parent';
export default async function Settings() {
  const { user } = await requireParent();
  return (
    <main className="narrow">
      <div className="eyebrow">ACCOUNT SETTINGS</div>
      <h1>Your account.</h1>
      <section className="panel">
        <h2>Parent identity</h2>
        <p className="small">{user.email}</p>
        <span className="status-badge">Email verified</span>
        <p className="small">
          <Link href="/auth/forgot-password">
            Request a password recovery email
          </Link>
        </p>
      </section>
      <section className="panel consent-section">
        <h2>Student permissions</h2>
        <p className="small">
          Manage each student’s separate capability decisions on their profile.
          Student login and teaching capabilities are not enabled.
        </p>
        <Link href="/parent">Choose a student →</Link>
      </section>
    </main>
  );
}
