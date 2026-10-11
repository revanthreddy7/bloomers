import 'server-only';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { classroomContext, readClassroom } from '@/server/classroom/service';
import {
  lessonContextSchema,
  mockOperationSchema,
  teachingPlanSchema,
} from '@/features/maya/contracts';
import { buildMockPlan, validatePlan } from '@/features/maya/planner';
import { createTeachingProvider } from './provider';

export async function mayaContext(studentId: string, scheduleId: string) {
  const { client, context, academic } = await classroomContext(
    studentId,
    scheduleId,
  );
  const snapshot = await readClassroom(studentId, scheduleId, 0);
  if (!snapshot.lesson) notFound();
  const ids = [...new Set(academic.items.map((i) => i.skill_id))];
  const prerequisiteIds = [
    ...new Set(
      academic.document.prerequisites
        .filter((e) => ids.includes(e.skillId))
        .map((e) => e.prerequisiteId),
    ),
  ].sort();
  if (prerequisiteIds.length > 20)
    throw new Error('Prerequisite context exceeds its bounds.');
  if (ids.length > 20 || context.objectives.length > 20)
    throw new Error('This lesson exceeds the teaching context bounds.');
  const [evidence, homework] = await Promise.all([
    client
      .from('student_skills')
      .select('skill_id,assessment_state,evidence_count,last_evidence_id')
      .eq('student_id', studentId)
      .in('skill_id', [...new Set([...ids, ...prerequisiteIds])])
      .limit(40),
    client
      .from('homework_assignments')
      .select('id')
      .eq('student_id', studentId)
      .limit(51),
  ]);
  if (evidence.error || homework.error)
    throw new Error('Teaching context unavailable.');
  const unit = academic.document.units.find((u) =>
    u.topics.some((t) => t.skills.some((s) => ids.includes(s.id))),
  );
  const topic = unit?.topics.find((t) =>
    t.skills.some((s) => ids.includes(s.id)),
  );
  if (!unit || !topic) notFound();
  const skills = academic.document.units.flatMap((u) =>
    u.topics.flatMap((t) => t.skills),
  );
  const packageData = lessonContextSchema.parse({
    schemaVersion: 1,
    mode: 'supervised_mock',
    studentReference: studentId,
    lessonReference: snapshot.lesson.id,
    scheduleReference: scheduleId,
    publicationReference: academic.publicationId,
    publicationVersion: context.curriculumVersion,
    course: context.course,
    unit: unit.name,
    topic: topic.name,
    chapterGuidance: {
      keyConcepts: topic.content.keyConcepts.slice(0, 5),
      explanations: topic.content.explanations.slice(0, 5),
      workedExamples: topic.content.workedExamples
        .slice(0, 3)
        .map((e) => ({ problem: e.problem, steps: e.steps.slice(0, 5) })),
      commonMistakes: topic.content.commonMistakes.slice(0, 5),
    },
    objectives: context.objectives,
    skills: ids.map((id) => {
      const skill = skills.find((s) => s.id === id)!;
      const state = evidence.data.find((s) => s.skill_id === id);
      const refs =
        state?.evidence_count && state.last_evidence_id
          ? [state.last_evidence_id]
          : [];
      return {
        id,
        code: skill.code,
        name: skill.name,
        prerequisites: academic.document.prerequisites
          .filter((e) => e.skillId === id)
          .map((e) => e.prerequisiteId)
          .sort(),
        learningState: refs.length
          ? 'recorded_evidence_requires_review'
          : 'unassessed',
        evidenceReferences: refs,
      };
    }),
    misconceptions: 'not_loaded_unverified',
    prerequisiteSkills: prerequisiteIds.map((id) => {
      const skill = skills.find((s) => s.id === id)!;
      const state = evidence.data.find((s) => s.skill_id === id);
      const refs =
        state?.evidence_count && state.last_evidence_id
          ? [state.last_evidence_id]
          : [];
      return {
        id,
        name: skill.name,
        learningState: refs.length
          ? 'recorded_evidence_requires_review'
          : 'unassessed',
        evidenceReferences: refs,
      };
    }),
    previousGenuineSummary: null,
    homework: {
      recordedAssignments: Math.min(homework.data.length, 50),
      partial: homework.data.length > 50,
    },
    policyVersion: 'maya-mock-1',
    constraints: {
      maxDurationSeconds: 300,
      externalRequests: false,
      mediaCapture: false,
      learningWrites: false,
    },
  });
  return { client, packageData, snapshot };
}
export async function operateMaya(
  studentId: string,
  scheduleId: string,
  value: unknown,
) {
  // Auth and canonical reservation scope are established before any operation.
  const { client, packageData } = await mayaContext(studentId, scheduleId);
  const parsed = mockOperationSchema.safeParse(value);
  if (!parsed.success) return { error: 'Invalid teaching request.' };
  try {
    if (parsed.data.action === 'start')
      await createTeachingProvider().plan(packageData);
    else buildMockPlan(packageData);
  } catch {
    return {
      error:
        'No reviewed simulation for this planned skill or provider configuration. Use mock mode.',
    };
  }
  const { data, error } = await client.rpc('maya_mock_operation', {
    p_schedule_id: scheduleId,
    p_request_id: parsed.data.commandId,
    p_epoch: parsed.data.expectedEpoch,
    p_action: parsed.data.action,
    p_speech_id: parsed.data.speechId ?? undefined,
  });
  if (error)
    return {
      error:
        error.code === '40001'
          ? 'Teaching changed or its playback step is not ready. Recover the lesson and try again.'
          : error.code === 'P5002'
            ? 'Teaching rate limit reached. Wait a minute.'
            : error.code === 'P5003'
              ? 'Teaching history is full. Stop or end the lesson.'
              : 'Teaching action unavailable. Check the lesson and supervised access.',
    };
  const result = z
    .strictObject({
      ok: z.boolean(),
      reason: z.enum(['duration', 'lesson_closed']).optional(),
    })
    .parse(data);
  return result.ok
    ? { ok: true }
    : {
        error:
          'The simulation expired or the lesson closed. Saved board work remains available.',
      };
}
export async function readMayaPlan(studentId: string, scheduleId: string) {
  const { client, packageData } = await mayaContext(studentId, scheduleId);
  const row = await client
    .from('lesson_plans')
    .select('plan')
    .eq('lesson_id', packageData.lessonReference)
    .maybeSingle();
  if (row.error) throw new Error('Teaching plan unavailable.');
  return row.data
    ? validatePlan(teachingPlanSchema.parse(row.data.plan), packageData)
    : buildMockPlan(packageData);
}
