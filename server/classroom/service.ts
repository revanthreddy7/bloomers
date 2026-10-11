import 'server-only';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getStudent } from '@/server/identity/students';
import { validateStructure } from '@/features/curriculum/engine';
import {
  appendSchema,
  lifecycleSchema,
  replaySchema,
} from '@/features/classroom/protocol';
export async function classroomContext(studentId: string, scheduleId: string) {
  if (!z.uuid().safeParse(scheduleId).success) notFound();
  const { client, student } = await getStudent(studentId, 'preview');
  const reservation = await client
    .from('lesson_schedules')
    .select(
      'id,student_id,starts_at,ends_at,timezone,status,course_plan_id,lesson_position',
    )
    .eq('id', scheduleId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (reservation.error) throw new Error('Classroom context unavailable.');
  if (!reservation.data?.course_plan_id) notFound();
  const plan = await client
    .from('course_plans')
    .select('id,student_course_id,curriculum_version_id,version')
    .eq('id', reservation.data.course_plan_id)
    .maybeSingle();
  if (plan.error || !plan.data) notFound();
  const enrollment = await client
    .from('student_courses')
    .select('curriculum_version_id,initialization_state')
    .eq('id', plan.data.student_course_id)
    .eq('student_id', studentId)
    .maybeSingle();
  if (
    enrollment.error ||
    enrollment.data?.initialization_state !== 'ready' ||
    enrollment.data.curriculum_version_id !== plan.data.curriculum_version_id
  )
    notFound();
  const [publication, items] = await Promise.all([
    client
      .from('curriculum_versions')
      .select('id,status,version,document')
      .eq('id', plan.data.curriculum_version_id)
      .eq('status', 'published')
      .maybeSingle(),
    client
      .from('course_plan_items')
      .select('skill_id,objectives,estimated_minutes')
      .eq('course_plan_id', plan.data.id)
      .eq('lesson_position', reservation.data.lesson_position!)
      .order('position')
      .limit(1001),
  ]);
  if (
    publication.error ||
    !publication.data ||
    items.error ||
    !items.data.length ||
    items.data.length > 1000
  )
    notFound();
  const document = validateStructure(publication.data.document);
  const selected = new Set(items.data.map((i) => i.skill_id));
  const topics = document.units
    .flatMap((u) => u.topics)
    .filter((t) => t.skills.some((s) => selected.has(s.id)))
    .map((t) => t.name);
  const objectives = [
    ...new Set(
      items.data.flatMap((i) => z.array(z.string()).parse(i.objectives)),
    ),
  ];
  return {
    client,
    academic: {
      document,
      publicationId: publication.data.id,
      items: items.data,
    },
    context: {
      studentName: student.display_name,
      studentId,
      scheduleId,
      course: document.name,
      curriculumVersion: publication.data.version,
      planVersion: plan.data.version,
      topics,
      objectives,
      reservation: reservation.data,
    },
  };
}
export async function readClassroom(
  studentId: string,
  scheduleId: string,
  after: number,
) {
  const { client } = await getStudent(studentId, 'preview');
  // Target is checked through RLS before invoking the actor-derived database reader.
  const row = await client
    .from('lesson_schedules')
    .select('id')
    .eq('id', scheduleId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (row.error || !row.data) notFound();
  const result = await client.rpc('classroom_replay', {
    p_schedule_id: scheduleId,
    p_after: after,
  });
  if (result.error) throw new Error('Classroom replay unavailable.');
  return replaySchema.parse(result.data);
}
export async function mutateClassroom(
  studentId: string,
  scheduleId: string,
  input: unknown,
  kind: 'lifecycle' | 'append',
) {
  const { client } = await getStudent(studentId, 'preview');
  const row = await client
    .from('lesson_schedules')
    .select('id')
    .eq('id', scheduleId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (row.error || !row.data) return { error: 'Classroom unavailable.' };
  const parsed =
    kind === 'lifecycle'
      ? lifecycleSchema.safeParse(input)
      : appendSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid classroom request.' };
  const result =
    'action' in parsed.data
      ? await client.rpc('classroom_lifecycle', {
          p_schedule_id: scheduleId,
          p_request_id: parsed.data.commandId,
          p_action: parsed.data.action,
        })
      : await client.rpc('classroom_append', {
          p_schedule_id: scheduleId,
          p_request_id: parsed.data.commandId,
          p_epoch: parsed.data.expectedEpoch,
          p_command: parsed.data.command,
        });
  if (result.error)
    return {
      error:
        result.error.code === 'P5002'
          ? 'Classroom event limit reached. Wait a minute before trying again.'
          : result.error.code === 'P5003'
            ? 'This preview’s history is full. End the lesson; your saved work remains available.'
            : result.error.code === 'P5001'
              ? 'End the other open classroom before starting this lesson.'
              : result.error.code === '40001'
                ? 'The lesson changed. Refresh its state and try again.'
                : 'This action is unavailable. Check lesson state, reservation and supervised access.',
    };
  if (kind === 'append' && result.data === null)
    return {
      error:
        'This classroom was abandoned after inactivity. Saved work remains read-only.',
    };
  return { ok: true, id: result.data };
}
export type ClassroomContext = Awaited<
  ReturnType<typeof classroomContext>
>['context'];
