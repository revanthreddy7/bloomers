'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
const views = ['Overview', 'Course', 'Progress', 'Homework', 'Schedule'];
export function ParentNavigation({
  students,
}: {
  students: { id: string; display_name: string }[];
}) {
  const path = usePathname(),
    router = useRouter();
  const match = path.match(/^\/parent\/(?:learners|students)\/([^/]+)/);
  const selected = students.find((s) => s.id === match?.[1]) ?? students[0];
  const currentView = path.split('/').at(-1);
  return (
    <aside className="app-sidebar">
      {selected && (
        <label className="student-selector">
          Selected student
          <select
            aria-label="Selected student"
            value={selected.id}
            onChange={(event) =>
              router.push(
                `/parent/learners/${event.target.value}/${views.map((v) => v.toLowerCase()).includes(currentView!) ? currentView : 'overview'}`,
              )
            }
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.display_name}
              </option>
            ))}
          </select>
        </label>
      )}
      <nav aria-label="Parent application" className="app-navigation">
        {views.map((view) => {
          const href = selected
            ? `/parent/learners/${selected.id}/${view.toLowerCase()}`
            : '/parent';
          return selected || view === 'Overview' ? (
            <Link
              key={view}
              href={href}
              aria-current={
                path === href || (view === 'Overview' && path === '/parent')
                  ? 'page'
                  : undefined
              }
            >
              {view}
            </Link>
          ) : (
            <span key={view} className="inactive-nav">
              {view} · Add a student
            </span>
          );
        })}
        <Link
          href="/parent/settings"
          aria-current={path === '/parent/settings' ? 'page' : undefined}
        >
          Settings
        </Link>
      </nav>
      <p className="small">Teaching, voice and camera are inactive.</p>
    </aside>
  );
}
export function PreviewNavigation({ studentId }: { studentId: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Student preview navigation" className="preview-navigation">
      {[
        ['Home', ''],
        ['Course', 'course'],
        ['Homework', 'homework'],
        ['Progress', 'progress'],
      ].map(([label, view]) => {
        const href = `/preview/${studentId}${view ? '/' + view : ''}`;
        return (
          <Link
            key={label}
            href={href}
            aria-current={path === href ? 'page' : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
