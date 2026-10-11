import Link from 'next/link';
import { requireAcademicReader } from '@/server/curriculum/access';
import { signOut } from '@/server/identity/actions';
export const dynamic = 'force-dynamic';
export default async function CurriculumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = await requireAcademicReader();
  return (
    <div className="identity-shell">
      <header className="account-header">
        <Link className="brand" href="/">
          ✳ BLOOMERS
        </Link>
        <nav aria-label="Curriculum navigation">
          <Link href="/curriculum">Curriculum</Link>
          {role === 'PARENT' && <Link href="/parent">Students</Link>}
          <form action={signOut}>
            <button className="text-button">Sign out</button>
          </form>
        </nav>
      </header>
      {children}
      <footer className="account-footer">
        Published academic content · Teaching features are not active
      </footer>
    </div>
  );
}
