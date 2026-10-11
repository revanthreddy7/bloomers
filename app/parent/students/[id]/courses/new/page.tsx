import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { getStudent } from '@/server/identity/students';
import { listPublishedCourses } from '@/server/curriculum/service';
import { listStudentEnrollments } from '@/server/planning/service';
import { EnrollmentForm } from '@/components/planning/enrollment-form';
export default async function EnrollmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student } = await getStudent(id);
  const [courses, { enrollments }] = await Promise.all([
    listPublishedCourses(),
    listStudentEnrollments(id),
  ]);
  const eligible = courses.filter(
    (course) => !enrollments.some((e) => e.course_id === course.courseId),
  );
  return (
    <main className="narrow">
      <Link href={`/parent/students/${id}`}>← Student profile</Link>
      <h1>Enroll {student.display_name}</h1>
      <p>
        Select a published course and tell us when lessons fit your week. This
        creates a persistent initial learning roadmap.
      </p>
      {enrollments.length > 0 && (
        <section className="panel">
          <h2>Existing enrollments</h2>
          <ul>
            {enrollments.map((e) => (
              <li key={e.id}>
                <Link href={`/parent/students/${id}/courses/${e.id}`}>
                  View existing roadmap
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!eligible.length ? (
        <p>No additional published courses are available for enrollment.</p>
      ) : (
        <section className="panel">
          <EnrollmentForm
            studentId={id}
            requestId={randomUUID()}
            courses={eligible.map((course) => ({
              id: course.id,
              name: course.document.name,
              version: course.version,
            }))}
          />
        </section>
      )}
    </main>
  );
}
