import Link from 'next/link';
import { getRoadmap } from '@/server/planning/service';
import {
  orderedStructure,
  relatedSkills,
  skills,
} from '@/features/curriculum/engine';
import { preferencesSummary } from '@/features/planning/scheduler';
export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ id: string; enrollmentId: string }>;
}) {
  const { id, enrollmentId } = await params;
  const roadmap = await getRoadmap(id, enrollmentId);
  const names = new Map(
    skills(roadmap.document).map((skill) => [skill.id, skill.name]),
  );
  const format = (instant: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: roadmap.preferences.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(instant));
  const completion = roadmap.schedules.at(-1)!.ends_at;
  const planState =
    { planned: 'Not started', active: 'In progress', completed: 'Completed' }[
      roadmap.plan.status
    ] ?? 'Planned';
  return (
    <main>
      <Link href={`/parent/students/${id}`}>← Student profile</Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PERSONALIZED ROADMAP</div>
          <h1>{roadmap.student.display_name}’s learning roadmap</h1>
          <h2>{roadmap.document.name}</h2>
          <p>
            Curriculum version {roadmap.publication.version} · Plan version{' '}
            {roadmap.plan.version}
          </p>
        </div>
        <span className="status-badge">{planState}</span>
      </div>
      <section className="panel">
        <h2>Initial plan and availability</h2>
        <p>{preferencesSummary(roadmap.preferences)}</p>
        <p>
          {roadmap.preferences.slots
            .map(
              (slot) =>
                `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.weekday]} ${slot.time}`,
            )
            .join(' · ')}
        </p>
        <p>
          Estimated completion: {format(completion)} (
          {roadmap.preferences.timezone})
        </p>
        <p className="small">
          The plan follows prerequisites and estimated instructional time. Dates
          and completion are projections, not guarantees. There is no assessment
          evidence invented by enrollment.
        </p>
      </section>
      <section className="consent-section">
        <h2>Projected lesson sequence</h2>
        <ol className="roadmap-lessons">
          {roadmap.schedules.map((schedule) => {
            const items = roadmap.items.filter(
              (item) => item.lesson_position === schedule.lesson_position,
            );
            return (
              <li className="panel" key={schedule.id}>
                <h3>Lesson {schedule.lesson_position}</h3>
                <p>
                  {format(schedule.starts_at)} –{' '}
                  {new Intl.DateTimeFormat('en-US', {
                    timeZone: roadmap.preferences.timezone,
                    timeStyle: 'short',
                  }).format(new Date(schedule.ends_at))}
                </p>
                <span className="status-badge">
                  {{
                    scheduled: 'Planned',
                    completed: 'Completed',
                    cancelled: 'Cancelled',
                    missed: 'Missed',
                  }[schedule.status] ?? schedule.status}
                </span>
                <p>
                  Reserved duration: {roadmap.preferences.lessonDurationMinutes}{' '}
                  minutes · Estimated instructional work:{' '}
                  {items.reduce(
                    (sum, item) => sum + (item.estimated_minutes ?? 0),
                    0,
                  )}{' '}
                  minutes
                </p>
                <ol>
                  {items.map((item) => (
                    <li key={item.id}>
                      <strong>{names.get(item.skill_id!)}</strong> ·{' '}
                      {item.estimated_minutes} estimated minutes
                      <ul>
                        {Array.isArray(item.objectives) &&
                          item.objectives.map((objective, index) => (
                            <li key={index}>{String(objective)}</li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="consent-section">
        <h2>Upcoming scheduled lessons</h2>
        {roadmap.schedules
          .filter(
            (s) =>
              s.status === 'scheduled' && new Date(s.starts_at) > new Date(),
          )
          .map((s) => (
            <p key={s.id}>
              Lesson {s.lesson_position}: {format(s.starts_at)} (
              {roadmap.preferences.timezone})
            </p>
          ))}
      </section>
      <section className="consent-section">
        <h2>Academic roadmap</h2>
        {orderedStructure(roadmap.document).map((unit) => (
          <section className="panel" key={unit.id}>
            <h3>{unit.name}</h3>
            {unit.topics.map((topic) => (
              <div key={topic.id}>
                <h4>{topic.name}</h4>
                <ul>
                  {topic.skills.map((skill) => {
                    const state = roadmap.skills.find(
                      (s) => s.skill_id === skill.id,
                    );
                    return (
                      <li key={skill.id}>
                        <strong>{skill.name}</strong>
                        <p>
                          {state?.assessment_state === 'evidenced'
                            ? `Assessment evidence recorded (${state.evidence_count} records)`
                            : 'Not yet assessed'}
                        </p>
                        <p>
                          Prerequisites:{' '}
                          {relatedSkills(
                            roadmap.document,
                            skill.id,
                            'prerequisites',
                          )
                            .map((id) => names.get(id))
                            .join(', ') || 'None'}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </section>
    </main>
  );
}
