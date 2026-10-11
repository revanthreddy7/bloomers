import Link from 'next/link';
import { requireParent } from '@/server/identity/parent';
import { signOut } from '@/server/identity/actions';
import { listApplicationStudents } from '@/server/application/service';
import { ParentNavigation } from '@/components/application/navigation';
export const dynamic = 'force-dynamic';
export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireParent();
  const { students, hasMore } = await listApplicationStudents();
  return (
    <div className="identity-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="account-header">
        <Link href="/parent" className="brand">
          ✳ BLOOMERS
        </Link>
        <nav aria-label="Parent navigation">
          <Link href="/parent">Students</Link>
          <Link href="/curriculum">Curriculum</Link>
          <Link href="/parent/settings">Account</Link>
          <form action={signOut}>
            <button className="text-button">Sign out</button>
          </form>
        </nav>
      </header>
      <div className="application-grid">
        <div>
          <ParentNavigation students={students} />
          {hasMore && (
            <p className="small">Showing the first 50 authorized profiles.</p>
          )}
        </div>
        <div className="application-content" id="main-content">
          {children}
        </div>
      </div>
      <footer className="account-footer">
        Parent account · Teaching features are not active
      </footer>
    </div>
  );
}
