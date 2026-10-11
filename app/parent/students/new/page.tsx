import { randomUUID } from 'node:crypto';
import { StudentForm } from '@/components/identity/forms';
import { requireParent } from '@/server/identity/parent';
export default async function NewStudent() {
  await requireParent();
  return (
    <main className="narrow">
      <div className="eyebrow">STUDENT PROFILE</div>
      <h1>A new learner.</h1>
      <p>Only the essentials for a thoughtful learning journey.</p>
      <section className="panel">
        <StudentForm requestId={randomUUID()} />
      </section>
    </main>
  );
}
