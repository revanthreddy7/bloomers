import Link from 'next/link';
import {
  academicModel,
  formatInstant,
  weeklyReservations,
  upcomingReservations,
  type LearningView,
} from '@/features/application/models';
import type { LearningViewModel } from '@/server/application/service';
import { startPreview } from '@/server/application/actions';
export function LearningContent({
  data,
  view,
  mode = 'parent',
  week = 0,
  familyOverview = false,
}: {
  data: LearningViewModel;
  view: LearningView;
  mode?: 'parent' | 'preview';
  week?: number;
  familyOverview?: boolean;
}) {
  const base =
    mode === 'parent'
      ? `/parent/learners/${data.student.id}`
      : `/preview/${data.student.id}`;
  const timezone = data.courses[0]?.preferences.timezone ?? 'UTC';
  const format = (instant: string) => formatInstant(instant, timezone);
  const labels = {
    overview:
      mode === 'preview'
        ? `Hi, ${data.student.display_name}.`
        : familyOverview
          ? 'Selected student overview'
          : `${data.student.display_name}’s overview`,
    course: 'Your course',
    progress: 'Learning progress',
    homework: 'Homework',
    schedule: 'Weekly schedule',
  };
  const nextCourse = data.courses.find(
    (c) => c.plan.id === data.next?.course_plan_id,
  );
  const nextItems =
    nextCourse?.items.filter(
      (i) => i.lesson_position === data.next?.lesson_position,
    ) ?? [];
  const objectives = nextItems.flatMap((i) =>
    Array.isArray(i.objectives)
      ? i.objectives.filter((v): v is string => typeof v === 'string')
      : [],
  );
  const scheduled = upcomingReservations(data.reservations, data.now);
  const Title = familyOverview ? 'h2' : 'h1';
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {mode === 'preview' ? 'YOUR LEARNING SPACE' : 'SELECTED STUDENT'}
          </div>
          <Title>{labels[view]}</Title>
          <p>
            {data.student.display_name} ·{' '}
            {data.student.grade
              ? `Grade ${data.student.grade}`
              : 'Grade not set'}
          </p>
        </div>
        {mode === 'parent' && (
          <div className="page-actions">
            <Link href={`/parent/students/${data.student.id}`}>
              Student profile & permissions
            </Link>
            <form action={startPreview.bind(null, data.student.id)}>
              <button className="secondary">Open student preview</button>
            </form>
          </div>
        )}
      </div>
      {data.truncated && (
        <p role="status" className="notice">
          This view shows up to 10 courses, 50 homework assignments, 50 recent
          lesson records, 100 weekly reservations and 10 upcoming lessons. Some
          records are outside this view.
        </p>
      )}
      {data.legacy && (
        <p className="notice">
          An older enrollment needs reviewed initialization before its roadmap
          can be shown.
        </p>
      )}
      {view === 'overview' && (
        <>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="eyebrow">WHAT HAPPENS NEXT</div>
              <h2>
                {data.next
                  ? 'Your next planned lesson'
                  : 'Make room for learning'}
              </h2>
              {data.next ? (
                <>
                  <p>{format(data.next.starts_at)}</p>
                  <p className="small">
                    {timezone} ·{' '}
                    {Math.round(
                      (Date.parse(data.next.ends_at) -
                        Date.parse(data.next.starts_at)) /
                        60000,
                    )}{' '}
                    minutes
                  </p>
                  {objectives.map((objective, i) => (
                    <p className="small" key={i}>
                      {objective}
                    </p>
                  ))}
                  <Link href={`${base}/schedule`}>View weekly schedule →</Link>
                  <p className="small">
                    Maya’s classroom is not available yet. No lesson can be
                    joined from this preview.
                  </p>
                </>
              ) : (
                <p>
                  No upcoming lesson reservations.{' '}
                  {data.courses.length
                    ? 'Your course roadmap remains available.'
                    : 'Choose a course to create an initial plan.'}
                </p>
              )}
            </section>
            <section className="panel">
              <h2>Course & roadmap</h2>
              {data.courses.length ? (
                data.courses.map((c) => (
                  <div key={c.enrollment.id}>
                    <h3>{c.document.name}</h3>
                    <p className="small">
                      Curriculum version {c.publication.version} ·{' '}
                      {c.enrollment.status === 'active'
                        ? 'Active enrollment'
                        : 'Completed enrollment'}
                    </p>
                    <p className="small">
                      Estimated completion:{' '}
                      {format(c.schedules.at(-1)!.ends_at)} · {timezone}
                    </p>
                    <Link href={`${base}/course`}>Explore the course →</Link>
                  </div>
                ))
              ) : (
                <>
                  <p>No course enrollment yet.</p>
                  {mode === 'parent' ? (
                    <Link
                      className="button"
                      href={`/parent/students/${data.student.id}/courses/new`}
                    >
                      Enroll in a course
                    </Link>
                  ) : (
                    <p>Your parent can choose a course from parent mode.</p>
                  )}
                </>
              )}
            </section>
            <section className="panel">
              <h2>Attendance</h2>
              {data.attendance.started ? (
                <p>
                  {data.attendance.completed} completed lesson records ·{' '}
                  {data.attendance.active} active lesson records in the latest
                  50. These are recorded sessions, not planned reservations.
                </p>
              ) : (
                <p>
                  Lessons haven’t started yet. No completed attendance records
                  are available.
                </p>
              )}
              <p className="small">
                A scheduled date does not demonstrate attendance.
              </p>
            </section>
            <section className="panel">
              <h2>Progress & attention</h2>
              <p>
                {data.progress.some((c) =>
                  c.skills.some((s) => s.evidenceCount > 0),
                )
                  ? 'Assessment evidence is available in the progress view. Reviewed mastery and attention recommendations are not available yet.'
                  : 'Learning progress will appear after Maya evaluates completed work. No assessment evidence is available yet.'}
              </p>
              <Link href={`${base}/progress`}>View learning progress →</Link>
            </section>
            <section className="panel">
              <h2>Homework</h2>
              <p>
                {data.homework.length
                  ? `${data.homework.length} persisted assignments in this view. Open Homework for recorded submission and review status.`
                  : 'No homework has been assigned.'}
              </p>
              <Link href={`${base}/homework`}>View homework →</Link>
            </section>
            <section className="panel">
              <h2>Upcoming lessons</h2>
              {scheduled.length ? (
                <ul className="simple-list">
                  {scheduled.slice(0, 3).map((row) => (
                    <li key={row.id}>{format(row.starts_at)} · Planned</li>
                  ))}
                </ul>
              ) : (
                <p>No upcoming lessons are scheduled.</p>
              )}
              <p className="small">Dates and completion are estimates.</p>
            </section>
          </div>
          {mode === 'preview' && (
            <section className="panel consent-section">
              <h2>This week</h2>
              <ScheduleContent
                data={data}
                base={base}
                timezone={timezone}
                week={0}
              />
            </section>
          )}
        </>
      )}
      {view === 'course' && (
        <>
          {!data.courses.length && (
            <section className="panel">
              <h2>Your learning roadmap</h2>
              <p>No initialized course is available yet.</p>
              {mode === 'parent' && (
                <Link href={`/parent/students/${data.student.id}/courses/new`}>
                  Enroll in a course →
                </Link>
              )}
            </section>
          )}
          {data.courses.map((c) => (
            <section key={c.enrollment.id} className="panel consent-section">
              <h2>{c.document.name}</h2>
              <p>
                Curriculum version {c.publication.version} · Plan version{' '}
                {c.plan.version} ·{' '}
                {{
                  planned: 'Not started',
                  active: 'In progress',
                  completed: 'Completed',
                }[c.plan.status as 'planned' | 'active' | 'completed'] ??
                  'Planned'}
              </p>
              <p className="small">
                Estimated completion:{' '}
                {formatInstant(
                  c.schedules.at(-1)!.ends_at,
                  c.preferences.timezone,
                )}{' '}
                · {c.preferences.timezone}
              </p>
              {mode === 'parent' && (
                <Link
                  href={`/parent/students/${data.student.id}/courses/${c.enrollment.id}`}
                >
                  View course roadmap
                </Link>
              )}
              <h3 className="section-title">Academic course content</h3>
              {academicModel(c.document).map((unit) => (
                <div key={unit.id}>
                  <h4>{unit.name}</h4>
                  {unit.topics.map((topic) => (
                    <div key={topic.id}>
                      <h5>{topic.name}</h5>
                      <ul>
                        {topic.skills.map((skill) => (
                          <li key={skill.id}>
                            <strong>{skill.name}</strong>
                            <p className="small">
                              Prerequisites:{' '}
                              {skill.prerequisites.join(', ') || 'None'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
              <h3 className="section-title">
                Student-specific projected lesson sequence
              </h3>
              <ol className="simple-list">
                {c.schedules.map((row) => (
                  <li key={row.id}>
                    <strong>Lesson {row.lesson_position}</strong> ·{' '}
                    {formatInstant(row.starts_at, c.preferences.timezone)} ·{' '}
                    {row.status === 'scheduled' ? 'Planned' : row.status}
                    <ul>
                      {c.items
                        .filter(
                          (i) => i.lesson_position === row.lesson_position,
                        )
                        .map((i) => (
                          <li key={i.id}>
                            {
                              c.document.units
                                .flatMap((u) =>
                                  u.topics.flatMap((t) => t.skills),
                                )
                                .find((s) => s.id === i.skill_id)?.name
                            }{' '}
                            · {i.estimated_minutes} estimated minutes
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <p className="small">
                Planned work is separate from assessment evidence. Check
                Progress for recorded learning information.
              </p>
            </section>
          ))}
        </>
      )}
      {view === 'progress' && (
        <>
          <section className="panel">
            <h2>What we know so far</h2>
            <p>
              Skill states below require a linked evidence record. Enrollment
              and scheduled lessons never prove mastery.
            </p>
            <p className="small">
              Reviewed “Currently learning”, “Needs review” and “Mastered”
              states will come from the future assessment service, after it
              validates the pinned requirements.
            </p>
          </section>
          {!data.progress.length && (
            <p>No enrolled skill records are available.</p>
          )}
          {data.progress.map((course) => (
            <section
              className="panel consent-section"
              key={course.enrollmentId}
            >
              <h2>
                {course.name} · Version {course.version}
              </h2>
              <ul className="simple-list">
                {course.skills.map((skill) => (
                  <li key={skill.id}>
                    <h3>{skill.name}</h3>
                    <span className="status-badge">{skill.status}</span>
                    <p className="small">{skill.description}</p>
                    {skill.evidenceCount > 0 && (
                      <p className="small">
                        {skill.evidenceCount} evidence records reported by the
                        canonical skill state. No mastery classification is
                        inferred here.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
      {view === 'homework' && (
        <>
          <section className="panel">
            <h2>
              {data.homework.length
                ? 'Recorded homework'
                : 'No homework has been assigned.'}
            </h2>
            <p>
              Homework assignment and completion workflows are not available
              yet. This view is read-only.
            </p>
          </section>
          <div className="dashboard-grid consent-section">
            {[
              'Assigned',
              'In progress',
              'Submitted',
              'Reviewed',
              ...(data.homework.some((h) => h.status === 'Status unavailable')
                ? ['Status unavailable']
                : []),
            ].map((status) => (
              <section className="panel" key={status}>
                <h2>{status}</h2>
                {data.homework.filter((h) => h.status === status).length ? (
                  <ul>
                    {data.homework
                      .filter((h) => h.status === status)
                      .map((h, i) => (
                        <li key={h.id}>
                          Assignment {i + 1} ·{' '}
                          {h.dueAt
                            ? `Due ${format(h.dueAt)} (${timezone})`
                            : 'No due date recorded'}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>
                    {status === 'In progress'
                      ? 'Work-in-progress tracking is not available yet.'
                      : `No ${status.toLowerCase()} homework records.`}
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      {view === 'schedule' && (
        <section className="panel">
          <h2>Lesson reservations</h2>
          <ScheduleContent
            data={data}
            base={base}
            timezone={timezone}
            week={week}
          />
          <h3 className="section-title">Upcoming lessons</h3>
          {scheduled.length ? (
            <ul className="simple-list">
              {scheduled.slice(0, 10).map((row) => (
                <li key={row.id}>{format(row.starts_at)} · Planned</li>
              ))}
            </ul>
          ) : (
            <p>No upcoming lessons are scheduled.</p>
          )}
          <p className="small">
            The course sets academic requirements; the calendar holds projected
            dates. Schedule changes and Maya classrooms are not enabled.
          </p>
        </section>
      )}
    </>
  );
}
function ScheduleContent({
  data,
  base,
  timezone,
  week,
}: {
  data: LearningViewModel;
  base: string;
  timezone: string;
  week: number;
}) {
  const window = weeklyReservations(
    data.reservations,
    timezone,
    data.now,
    week,
  );
  return (
    <>
      <div className="week-heading">
        <h3>Week of {window.start}</h3>
        <nav aria-label="Week navigation">
          {week > -104 && (
            <Link href={`${base}/schedule?week=${week - 1}`}>
              Previous week
            </Link>
          )}
          <Link href={`${base}/schedule?week=0`}>Current week</Link>
          {week < 104 && (
            <Link href={`${base}/schedule?week=${week + 1}`}>Next week</Link>
          )}
        </nav>
      </div>
      <p className="small">
        Displayed timezone: {timezone} · Monday through Sunday. Reservations are
        stored as UTC instants.
      </p>
      {window.lessons.length ? (
        <ul className="simple-list">
          {window.lessons.map((row) => {
            const course = data.courses.find(
              (c) => c.plan.id === row.course_plan_id,
            );
            return (
              <li key={row.id}>
                <strong>
                  {course?.document.name ?? 'Lesson'} · Lesson{' '}
                  {row.lesson_position}
                </strong>
                <p>
                  {formatInstant(row.starts_at, timezone)} –{' '}
                  {formatInstant(row.ends_at, timezone)}
                </p>
                <p className="small">
                  {Math.round(
                    (Date.parse(row.ends_at) - Date.parse(row.starts_at)) /
                      60000,
                  )}{' '}
                  minutes ·{' '}
                  {row.status === 'scheduled' ? 'Planned' : row.status} ·{' '}
                  {timezone}
                </p>
                {course?.items
                  .filter((i) => i.lesson_position === row.lesson_position)
                  .flatMap((i) =>
                    Array.isArray(i.objectives) ? i.objectives : [],
                  )
                  .map((objective, index) => (
                    <p className="small" key={index}>
                      {String(objective)}
                    </p>
                  ))}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No lessons are reserved for this week.</p>
      )}
    </>
  );
}
