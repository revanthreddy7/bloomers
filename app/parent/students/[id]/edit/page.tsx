import { StudentForm } from '@/components/identity/forms';
import { getStudent } from '@/server/identity/students';
export default async function EditStudent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student } = await getStudent(id);
  return (
    <main className="narrow">
      <div className="eyebrow">STUDENT PROFILE</div>
      <h1>Edit profile.</h1>
      <section className="panel">
        <StudentForm student={student} />
      </section>
    </main>
  );
}
