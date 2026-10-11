import Link from 'next/link';
import { listPublishedCourses } from '@/server/curriculum/service';
export default async function CurriculumPage() {
  const courses = await listPublishedCourses();
  return (
    <main className="account-content">
      <h1>Curriculum Explorer</h1>
      <p>
        Explore the published academic foundation. This prototype is a small
        sample of Grade 8 mathematics.
      </p>
      {!courses.length && <p>No courses have been published.</p>}
      {courses.map((course) => (
        <article className="panel" key={course.id}>
          <h2>
            <Link href={`/curriculum/${course.courseId}?version=${course.id}`}>
              {course.document.name}
            </Link>
          </h2>
          <p>{course.document.description}</p>
          <p>
            Grade {course.document.academicLevel} · {course.document.subject} ·
            Version {course.version}
          </p>
        </article>
      ))}
    </main>
  );
}
