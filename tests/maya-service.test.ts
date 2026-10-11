import { beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import sample from '@/supabase/fixtures/grade-8.json';
import { curriculumSchema } from '@/features/curriculum/schema';
const mocks = vi.hoisted(() => ({
  classroomContext: vi.fn(),
  readClassroom: vi.fn(),
  rpc: vi.fn(),
  records: [] as {
    skill_id: string;
    evidence_count: number;
    assessment_state: string;
    last_evidence_id: string | null;
  }[],
  homework: [] as { id: string }[],
  queries: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('@/server/classroom/service', () => ({
  classroomContext: mocks.classroomContext,
  readClassroom: mocks.readClassroom,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));
import {
  mayaContext,
  operateMaya,
  readMayaPlan,
} from '@/server/maya/orchestrator';
import { invokeMayaTool } from '@/server/maya/tools';
const student = randomUUID(),
  schedule = randomUUID(),
  lesson = randomUUID();
beforeEach(() => {
  vi.resetAllMocks();
  mocks.queries = [];
  mocks.records = [];
  mocks.homework = [];
  const client = {
    rpc: mocks.rpc,
    from: (table: string) => {
      mocks.queries.push(table);
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in']) chain[method] = () => chain;
      chain.limit = async () => ({
        error: null,
        data: table === 'student_skills' ? mocks.records : mocks.homework,
      });
      chain.maybeSingle = async () => ({ error: null, data: null });
      return chain;
    },
  };
  const doc = curriculumSchema.parse(sample);
  mocks.classroomContext.mockResolvedValue({
    client,
    context: {
      curriculumVersion: 1,
      course: doc.name,
      objectives: ['Add signed integers.'],
    },
    academic: {
      document: doc,
      publicationId: '00000000-0000-0000-0000-000000000101',
      items: [{ skill_id: doc.units[0].topics[0].skills[0].id }],
    },
  });
  mocks.readClassroom.mockResolvedValue({
    lesson: { id: lesson, sequence: 0, epoch: 0, status: 'active' },
    events: [],
  });
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});
it('server context is publication-scoped, bounded and contains no parent identity or private answer/history reads', async () => {
  const { packageData } = await mayaContext(student, schedule);
  expect(packageData.publicationReference).toBe(
    '00000000-0000-0000-0000-000000000101',
  );
  expect(packageData.skills[0].learningState).toBe('unassessed');
  expect(packageData.skills[0].evidenceReferences).toEqual([]);
  expect(packageData.previousGenuineSummary).toBeNull();
  expect(mocks.queries).toEqual(['student_skills', 'homework_assignments']);
  expect(packageData).not.toHaveProperty('studentName');
  expect(mocks.classroomContext).toHaveBeenCalledWith(student, schedule);
});
it('genuine evidence is referenced without manufacturing assessed mastery', async () => {
  mocks.records = [
    {
      skill_id: '00000000-0000-0000-0000-000000000011',
      evidence_count: 2,
      assessment_state: 'assessed',
      last_evidence_id: randomUUID(),
    },
  ];
  const { packageData } = await mayaContext(student, schedule);
  expect(packageData.skills[0].learningState).toBe(
    'recorded_evidence_requires_review',
  );
  expect(packageData.skills[0].evidenceReferences).toEqual([
    mocks.records[0].last_evidence_id,
  ]);
  expect(packageData.skills[0]).not.toHaveProperty('mastery');
});
it('partial homework context is labeled and bounded', async () => {
  mocks.homework = Array.from({ length: 51 }, () => ({ id: randomUUID() }));
  expect((await mayaContext(student, schedule)).packageData.homework).toEqual({
    recordedAssignments: 50,
    partial: true,
  });
});
it('foreign/unauthorized contexts fail before any model, tool or privileged operation', async () => {
  mocks.classroomContext.mockRejectedValue(new Error('scope denied'));
  await expect(
    operateMaya(student, schedule, {
      commandId: randomUUID(),
      expectedEpoch: 0,
      action: 'start',
      speechId: null,
    }),
  ).rejects.toThrow('scope denied');
  await expect(
    invokeMayaTool(student, schedule, {
      name: 'get_lesson_context',
      arguments: {},
    }),
  ).rejects.toThrow('scope denied');
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.queries).toEqual([]);
});
it('a canonical active classroom is required', async () => {
  mocks.readClassroom.mockResolvedValue({ lesson: null, events: [] });
  await expect(mayaContext(student, schedule)).rejects.toThrow('notFound');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('the orchestrator validates controls and never accepts a supplied provider or actor', async () => {
  expect(
    await operateMaya(student, schedule, {
      commandId: randomUUID(),
      expectedEpoch: 0,
      action: 'start',
      speechId: null,
      actor: 'ADMIN',
    }),
  ).toHaveProperty('error');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('the scoped operation only passes typed identifiers and enum controls', async () => {
  const commandId = randomUUID();
  expect(
    await operateMaya(student, schedule, {
      commandId,
      expectedEpoch: 0,
      action: 'start',
      speechId: null,
    }),
  ).toEqual({ ok: true });
  expect(mocks.rpc).toHaveBeenCalledWith('maya_mock_operation', {
    p_schedule_id: schedule,
    p_request_id: commandId,
    p_epoch: 0,
    p_action: 'start',
    p_speech_id: undefined,
  });
});
it.each(['40001', '42501', 'P5002', 'P5003'])(
  'database failure %s is curated without leaking internal content',
  async (code) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code, message: 'private answers and keys' },
    });
    const result = await operateMaya(student, schedule, {
      commandId: randomUUID(),
      expectedEpoch: 0,
      action: 'start',
      speechId: null,
    });
    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain('private');
  },
);
it('duration expiry is reported as stopped rather than acknowledged as teaching', async () => {
  mocks.rpc.mockResolvedValue({
    data: { ok: false, reason: 'duration' },
    error: null,
  });
  expect(
    await operateMaya(student, schedule, {
      commandId: randomUUID(),
      expectedEpoch: 0,
      action: 'hint',
      speechId: null,
    }),
  ).toHaveProperty('error');
});
it('tools return bounded context and strict proposals while forbidden mutations remain unavailable', async () => {
  expect(
    (
      await invokeMayaTool(student, schedule, {
        name: 'get_lesson_context',
        arguments: {},
      })
    ).type,
  ).toBe('context');
  expect(
    await invokeMayaTool(student, schedule, {
      name: 'write_whiteboard_math',
      arguments: { text: 'x = 4', at: { x: 0.1, y: 0.2 } },
    }),
  ).toEqual({
    type: 'board_proposal',
    value: { kind: 'write_math', text: 'x = 4', at: { x: 0.1, y: 0.2 } },
  });
  await expect(
    invokeMayaTool(student, schedule, {
      name: 'update_mastery',
      arguments: {},
    }),
  ).rejects.toThrow();
  expect(mocks.rpc).toHaveBeenCalledWith(
    'maya_mock_tool_audit',
    expect.objectContaining({ p_name: 'unapproved', p_outcome: 'rejected' }),
  );
});
it('plan retrieval uses pinned validated deterministic fallback', async () => {
  const plan = await readMayaPlan(student, schedule);
  expect(plan.provenance.provider).toBe('mock');
  expect(plan.newSkills).toEqual(['00000000-0000-0000-0000-000000000011']);
});
