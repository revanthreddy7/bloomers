import Link from 'next/link';
import { requireParent } from '@/server/identity/parent';
import { signOut } from '@/server/identity/actions';
export const dynamic = 'force-dynamic';
export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireParent();
  return (
    <div className="identity-shell">
      <header className="account-header">
        <Link href="/parent" className="brand">
          ✳ BLOOMERS
        </Link>
        <nav aria-label="Parent navigation">
          <Link href="/parent">Students</Link>
          <Link href="/parent/settings">Account</Link>
          <form action={signOut}>
            <button className="text-button">Sign out</button>
          </form>
        </nav>
      </header>
      {children}
      <footer className="account-footer">
        Parent account · Phase 1 · Teaching features are not active
      </footer>
    </div>
  );
}
