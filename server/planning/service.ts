import 'server-only';
import { notFound } from 'next/navigation';
import { academicIdSchema } from '@/features/curriculum/schema';
import { validateStructure } from '@/features/curriculum/engine';
import { validatePreferences } from '@/features/planning/schema';
import { getStudent } from '@/server/identity/students';
export async function listStudentEnrollments(studentId: string) {
  const { client, student } = await getStudent(studentId);
  const { data, error } = await client
    .from('student_courses')
    .select('id,course_id,curriculum_version_id,status,initialization_state')
    .eq('student_id', studentId)
    .order('enrolled_at');
  if (error) throw new Error('Enrollments could not be loaded');
  return { student, enrollments: data };
}
export async function getRoadmap(studentId: string, enrollmentId: string) {
  if (!academicIdSchema.safeParse(enrollmentId).success) notFound();
  const { client, student } = await getStudent(studentId);
  const enrollment = await client
    .from('student_courses')
    .select('*')
    .eq('id', enrollmentId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (enrollment.error) throw new Error('Enrollment could not be loaded');
  if (!enrollment.data) notFound();
  if (enrollment.data.initialization_state !== 'ready')
    throw new Error('This legacy enrollment needs reviewed initialization');
  const [publication, plan, availability] = await Promise.all([
    client
      .from('curriculum_versions')
      .select('id,version,status,document')
      .eq('id', enrollment.data.curriculum_version_id)
      .maybeSingle(),
    client
      .from('course_plans')
      .select('*')
      .eq('student_course_id', enrollmentId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from('availability_preferences')
      .select('preferences')
      .eq('student_course_id', enrollmentId)
      .maybeSingle(),
  ]);
  if (
    publication.error ||
    plan.error ||
    availability.error ||
    !publication.data ||
    !plan.data ||
    !availability.data ||
    publication.data.status !== 'published' ||
    plan.data.curriculum_version_id !== publication.data.id
  )
    throw new Error('Roadmap could not be resolved');
  const document = validateStructure(publication.data.document),
    preferences = validatePreferences(availability.data.preferences);
  const [items, schedules, studentSkills] = await Promise.all([
    client
      .from('course_plan_items')
      .select('*')
      .eq('course_plan_id', plan.data.id)
      .order('position'),
    client
      .from('lesson_schedules')
      .select('*')
      .eq('course_plan_id', plan.data.id)
      .eq('student_id', studentId)
      .order('lesson_position'),
    client
      .from('student_skills')
      .select(
        'skill_id,mastery_score,confidence,evidence_count,last_evidence_id,assessment_state',
      )
      .eq('student_id', studentId),
  ]);
  if (
    items.error ||
    schedules.error ||
    studentSkills.error ||
    !items.data.length ||
    !schedules.data.length
  )
    throw new Error('Roadmap records could not be loaded');
  return {
    student,
    enrollment: enrollment.data,
    publication: publication.data,
    document,
    plan: plan.data,
    preferences,
    items: items.data,
    schedules: schedules.data,
    skills: studentSkills.data,
  };
}
