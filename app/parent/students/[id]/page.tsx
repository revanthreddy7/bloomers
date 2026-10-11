import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { getStudent } from '@/server/identity/students';
import { capabilityLabels } from '@/features/identity/validation';
import { ConsentForm } from '@/components/identity/forms';
export default async function StudentProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, client } = await getStudent(id);
  const [policies, history, enrollments] = await Promise.all([
    client
      .from('consent_policies')
      .select('consent_type,version,description,approved')
      .neq('consent_type', 'pilot')
      .order('consent_type')
      .order('version'),
    client
      .from('consents')
      .select('id,consent_type,policy_version,granted,recorded_at,source')
      .eq('student_id', id)
      .order('event_order', { ascending: false }),
    client
      .from('student_courses')
      .select('id,status,initialization_state')
      .eq('student_id', id)
      .order('enrolled_at'),
  ]);
  if (policies.error || history.error || enrollments.error)
    throw new Error('Consent settings could not be loaded.');
  return (
    <main>
      <Link href="/parent">← All students</Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">STUDENT PROFILE</div>
          <h1>{student.display_name}</h1>
          <p>Grade {student.grade ?? 'not set'}</p>
        </div>
        <Link className="button secondary" href={`/parent/students/${id}/edit`}>
          Edit profile
        </Link>
      </div>
      {student.learning_goals && (
        <section className="panel">
          <h2>Learning goals</h2>
          <p className="small preserve-lines">{student.learning_goals}</p>
        </section>
      )}
      <section className="panel consent-section">
        <h2>Course enrollments</h2>
        {!enrollments.data.length && <p>No courses enrolled yet.</p>}
        <ul>
          {enrollments.data.map((enrollment) => (
            <li key={enrollment.id}>
              {enrollment.initialization_state === 'ready' ? (
                <Link href={`/parent/students/${id}/courses/${enrollment.id}`}>
                  View course roadmap
                </Link>
              ) : (
                <span>Existing enrollment needs reviewed initialization</span>
              )}
              {' · '}
              {enrollment.status === 'completed'
                ? 'Completed enrollment'
                : 'Active enrollment'}
            </li>
          ))}
        </ul>
        <Link
          className="button secondary"
          href={`/parent/students/${id}/courses/new`}
        >
          Enroll in a course
        </Link>
      </section>
      <section className="consent-section">
        <h2>Capability permissions</h2>
        <p className="small">
          Each capability has its own policy. No AI sessions, microphone,
          camera, uploads, or recording are active. Draft policies cannot
          receive new grants.
        </p>
        <div className="consent-grid">
          {policies.data?.map((policy) => {
            const latest = history.data?.find(
              (entry) =>
                entry.consent_type === policy.consent_type &&
                entry.policy_version === policy.version,
            );
            return (
              <article
                className="panel"
                key={`${policy.consent_type}:${policy.version}`}
              >
                <h3>
                  {capabilityLabels[policy.consent_type] ?? policy.consent_type}
                </h3>
                <span className="status-badge">
                  {policy.approved
                    ? 'Approved policy'
                    : 'Draft · approval pending'}
                </span>
                <p className="small">{policy.description}</p>
                <p className="small">
                  Policy: {policy.version}
                  <br />
                  Your decision:{' '}
                  {latest
                    ? latest.granted
                      ? 'Granted'
                      : 'Withdrawn'
                    : 'Not granted'}
                </p>
                <ConsentForm
                  studentId={id}
                  type={policy.consent_type}
                  version={policy.version}
                  approved={policy.approved}
                  granted={latest?.granted ?? false}
                  requestId={randomUUID()}
                />
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel consent-section">
        <h2>Consent history</h2>
        {!history.data?.length ? (
          <p className="small">No decisions recorded yet.</p>
        ) : (
          <ul className="history-list">
            {history.data.map((entry) => (
              <li key={entry.id}>
                <strong>
                  {capabilityLabels[entry.consent_type] ?? entry.consent_type}:{' '}
                  {entry.granted ? 'Granted' : 'Withdrawn'}
                </strong>
                <span>
                  {entry.policy_version} ·{' '}
                  {new Date(entry.recorded_at).toISOString()} · {entry.source}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="field-help">
          These are your decisions. Every change adds a record; earlier
          decisions are preserved.
        </p>
      </section>
    </main>
  );
}
