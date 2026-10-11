import 'server-only';
import { cache } from 'react';
import { requireParent } from '@/server/identity/parent';
import { getStudent } from '@/server/identity/students';
import { getRoadmap } from '@/server/planning/service';
import {
  progressModel,
  homeworkModel,
  attendanceModel,
  upcomingReservations,
  weekWindow,
} from '@/features/application/models';
export const listApplicationStudents = cache(async () => {
  const { client } = await requireParent();
  const { data, error } = await client
    .from('student_profiles')
    .select('id,display_name,grade')
    .order('created_at')
    .limit(51);
  if (error) throw new Error('Students could not be loaded.');
  return { students: data.slice(0, 50), hasMore: data.length > 50 };
});
export const getLearningView = cache(
  async (
    studentId: string,
    mode: 'parent' | 'preview' = 'parent',
    week = 0,
  ) => {
    const { client, student } = await getStudent(studentId, mode);
    const enrollments = await client
      .from('student_courses')
      .select('id,status,initialization_state,curriculum_version_id')
      .eq('student_id', studentId)
      .order('enrolled_at')
      .limit(11);
    if (enrollments.error) throw new Error('Courses could not be loaded.');
    const courses = await Promise.all(
      enrollments.data
        .slice(0, 10)
        .filter((e) => e.initialization_state === 'ready')
        .map((e) => getRoadmap(studentId, e.id, mode)),
    );
    const [assignments, attendance, evidence] = await Promise.all([
      client
        .from('homework_assignments')
        .select('id,due_at')
        .eq('student_id', studentId)
        .order('due_at', { nullsFirst: false })
        .limit(51),
      client
        .from('lessons')
        .select('status,started_at,ended_at')
        .eq('student_id', studentId)
        .order('started_at', { ascending: false, nullsFirst: false })
        .limit(51),
      readEvidence(client, studentId, [
        ...new Set(
          courses.flatMap((c) =>
            c.skills
              .map((s) => s.last_evidence_id)
              .filter((id): id is string => !!id),
          ),
        ),
      ]),
    ]);
    if (assignments.error || attendance.error || evidence.error)
      throw new Error('Learning records could not be loaded.');
    const ids = assignments.data.slice(0, 50).map((a) => a.id);
    const submissions = ids.length
      ? await client
          .from('homework_submissions')
          .select('id,assignment_id,submitted_at')
          .in('assignment_id', ids)
          .order('submitted_at', { ascending: false })
          .limit(201)
      : { data: [], error: null };
    if (submissions.error) throw new Error('Homework could not be loaded.');
    const submissionIds = submissions.data.slice(0, 200).map((s) => s.id);
    const results = submissionIds.length
      ? await client
          .from('homework_results')
          .select('submission_id')
          .in('submission_id', submissionIds)
          .limit(200)
      : { data: [], error: null };
    if (results.error) throw new Error('Homework review could not be loaded.');
    const now = new Date().toISOString();
    const window = weekWindow(
      now,
      courses[0]?.preferences.timezone ?? 'UTC',
      week,
    );
    // A padded UTC range includes every local week boundary, including DST.
    // Exact membership is determined by the shared timezone-aware view model.
    const lower = new Date(
      Date.parse(window.start + 'T00:00:00Z') - 86400000,
    ).toISOString();
    const upper = new Date(
      Date.parse(window.end + 'T00:00:00Z') + 86400000,
    ).toISOString();
    const fields =
      'id,starts_at,ends_at,status,timezone,lesson_position,course_plan_id' as const;
    const [weekly, upcoming] = await Promise.all([
      client
        .from('lesson_schedules')
        .select(fields)
        .eq('student_id', studentId)
        .gte('starts_at', lower)
        .lt('starts_at', upper)
        .order('starts_at')
        .limit(101),
      client
        .from('lesson_schedules')
        .select(fields)
        .eq('student_id', studentId)
        .eq('status', 'scheduled')
        .gte('starts_at', now)
        .order('starts_at')
        .limit(11),
    ]);
    if (weekly.error || upcoming.error)
      throw new Error('Schedule could not be loaded.');
    const reservations = [
      ...new Map(
        [...weekly.data.slice(0, 100), ...upcoming.data.slice(0, 10)].map(
          (row) => [row.id, row],
        ),
      ).values(),
    ];
    return {
      student,
      courses,
      reservations,
      next: upcomingReservations(reservations, now)[0] ?? null,
      now,
      progress: courses.map((c) => ({
        enrollmentId: c.enrollment.id,
        name: c.document.name,
        version: c.publication.version,
        skills: progressModel(c.document, c.skills, evidence.data),
      })),
      homework: homeworkModel(
        assignments.data.slice(0, 50),
        submissions.data.slice(0, 200),
        results.data,
        submissions.data.length <= 200,
      ),
      attendance: attendanceModel(attendance.data.slice(0, 50)),
      truncated:
        enrollments.data.length > 10 ||
        assignments.data.length > 50 ||
        attendance.data.length > 50 ||
        submissions.data.length > 200 ||
        weekly.data.length > 100 ||
        upcoming.data.length > 10,
      legacy: enrollments.data.some((e) => e.initialization_state !== 'ready'),
    };
  },
);
export type LearningViewModel = Awaited<ReturnType<typeof getLearningView>>;

async function readEvidence(
  client: Awaited<ReturnType<typeof getStudent>>['client'],
  studentId: string,
  ids: string[],
) {
  const batches = Array.from(
    { length: Math.ceil(ids.length / 1000) },
    (_, index) => ids.slice(index * 1000, (index + 1) * 1000),
  );
  const responses = await Promise.all(
    batches.map((batch) =>
      client
        .from('learning_evidence')
        .select('id,skill_id')
        .eq('student_id', studentId)
        .in('id', batch)
        .limit(1000),
    ),
  );
  return {
    data: responses.flatMap((r) => r.data ?? []),
    error: responses.find((r) => r.error)?.error ?? null,
  };
}
