import Link from 'next/link';
import { requireParent } from '@/server/identity/parent';
import { LearningContent } from '@/components/application/learning';
import {
  getLearningView,
  listApplicationStudents,
} from '@/server/application/service';
export default async function ParentHome() {
  await requireParent();
  const { students } = await listApplicationStudents();
  const learning = students[0] ? await getLearningView(students[0].id) : null;
  return (
    <main>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR FAMILY</div>
          <h1>Room to grow.</h1>
          <p>Manage the learners you support.</p>
        </div>
        <Link className="button" href="/parent/students/new">
          Add student
        </Link>
      </div>
      {!students?.length ? (
        <section className="panel empty-state">
          <div className="mark">✳</div>
          <h2>Start with one learner.</h2>
          <p>
            Add a display name and grade. There’s no need for a student email or
            password.
          </p>
          <Link href="/parent/students/new">Add your first student →</Link>
        </section>
      ) : (
        <div className="student-grid">
          {students.map((student) => (
            <Link
              className="panel student-card"
              href={`/parent/students/${student.id}`}
              key={student.id}
            >
              <span className="student-initial" aria-hidden="true">
                {student.display_name.slice(0, 1)}
              </span>
              <h2>{student.display_name}</h2>
              <p className="small">
                {student.grade ? `Grade ${student.grade}` : 'Grade not set'}
              </p>
              <span>View profile →</span>
            </Link>
          ))}
        </div>
      )}
      {learning && (
        <section className="consent-section">
          <LearningContent data={learning} view="overview" familyOverview />
        </section>
      )}
    </main>
  );
}
