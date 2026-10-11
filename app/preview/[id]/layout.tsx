import Link from 'next/link';
import { getStudent } from '@/server/identity/students';
import { PreviewNavigation } from '@/components/application/navigation';
export default async function StudentPreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student } = await getStudent(id, 'preview');
  return (
    <>
      <div className="preview-banner" role="note">
        <strong>Parent-assisted student preview</strong>
        <p className="small">
          You are viewing {student.display_name}’s learning space with your
          parent signed in. This is not a student login. To switch students or
          manage settings, return to parent mode.
        </p>
        <Link href="/preview/return">Return to parent mode →</Link>
      </div>
      <header className="preview-header">
        <span className="brand">✳ BLOOMERS</span>
        <PreviewNavigation studentId={id} />
      </header>
      <main id="main-content">{children}</main>
    </>
  );
}
