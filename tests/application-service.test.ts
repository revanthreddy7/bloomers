import { beforeEach, expect, it, vi } from 'vitest';
import sample from '@/supabase/fixtures/grade-8.json';
const mock = vi.hoisted(() => ({
  getStudent: vi.fn(),
  getRoadmap: vi.fn(),
  requireParent: vi.fn(),
  queries: [] as { table: string; method: string; args: unknown[] }[],
  rows: {} as Record<string, unknown[]>,
}));
vi.mock('server-only', () => ({}));
vi.mock('react', () => ({ cache: (fn: unknown) => fn }));
vi.mock('@/server/identity/students', () => ({ getStudent: mock.getStudent }));
vi.mock('@/server/planning/service', () => ({ getRoadmap: mock.getRoadmap }));
vi.mock('@/server/identity/parent', () => ({
  requireParent: mock.requireParent,
}));
import {
  getLearningView,
  listApplicationStudents,
} from '@/server/application/service';
const client = {
  from: (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lt'])
      chain[method] = (...args: unknown[]) => {
        mock.queries.push({ table, method, args });
        return chain;
      };
    chain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: mock.rows[table] ?? [], error: null }).then(
        resolve,
      );
    return chain;
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.queries = [];
  mock.rows = {
    student_courses: [
      { id: 'enrollment', status: 'active', initialization_state: 'ready' },
    ],
  };
  mock.getStudent.mockResolvedValue({
    client,
    student: { id: 'selected', display_name: 'Learner', grade: 8 },
  });
  mock.requireParent.mockResolvedValue({ client });
  mock.getRoadmap.mockResolvedValue({
    student: { id: 'selected' },
    enrollment: { id: 'enrollment', status: 'active' },
    document: sample,
    publication: { version: 1 },
    plan: { id: 'plan', version: 1, status: 'planned' },
    items: [],
    skills: [],
    schedules: [],
    preferences: { timezone: 'America/New_York' },
  });
});
it('authorizes the selected student before any academic read', async () => {
  mock.getStudent.mockRejectedValue(new Error('notFound'));
  await expect(getLearningView('foreign')).rejects.toThrow('notFound');
  expect(mock.queries).toEqual([]);
  expect(mock.getRoadmap).not.toHaveBeenCalled();
});
it('resolves existing roadmaps with the same authorized student context', async () => {
  const model = await getLearningView('selected');
  expect(mock.getRoadmap).toHaveBeenCalledWith(
    'selected',
    'enrollment',
    'parent',
  );
  expect(model.student.id).toBe('selected');
  expect(model.progress[0].skills).toHaveLength(5);
});
it('preserves preview authorization for every delegated roadmap read', async () => {
  await getLearningView('selected', 'preview');
  expect(mock.getStudent).toHaveBeenCalledWith('selected', 'preview');
  expect(mock.getRoadmap).toHaveBeenCalledWith(
    'selected',
    'enrollment',
    'preview',
  );
});
it('scopes all student-specific direct reads and bounds retrieval', async () => {
  await getLearningView('selected');
  for (const table of [
    'student_courses',
    'homework_assignments',
    'lessons',
    'lesson_schedules',
  ]) {
    expect(mock.queries).toContainEqual({
      table,
      method: 'eq',
      args: ['student_id', 'selected'],
    });
    expect(
      mock.queries.some((q) => q.table === table && q.method === 'limit'),
    ).toBe(true);
  }
});
it('does not request private evidence payloads, answers or reports', async () => {
  await getLearningView('selected');
  expect(
    mock.queries.some((q) =>
      ['questions', 'parent_reports', 'assessment_results'].includes(q.table),
    ),
  ).toBe(false);
  expect(
    mock.queries
      .filter((q) => q.method === 'select')
      .every((q) => !String(q.args[0]).includes('*')),
  ).toBe(true);
});
it('unassessed students retain truthful overview and homework states', async () => {
  const model = await getLearningView('selected');
  expect(model.next).toBeNull();
  expect(model.homework).toEqual([]);
  expect(model.attendance).toEqual({ started: false, active: 0, completed: 0 });
  expect(
    model.progress[0].skills.every((s) => s.status === 'Not yet assessed'),
  ).toBe(true);
});
it('legacy enrollments are marked rather than synthesized', async () => {
  mock.rows.student_courses = [
    { id: 'legacy', initialization_state: 'legacy' },
  ];
  const model = await getLearningView('selected');
  expect(model.legacy).toBe(true);
  expect(model.courses).toEqual([]);
  expect(mock.getRoadmap).not.toHaveBeenCalled();
});
it('student selector receives only bounded authorized profile fields', async () => {
  mock.rows.student_profiles = Array.from({ length: 51 }, (_, i) => ({
    id: String(i),
    display_name: 'Learner',
    grade: 8,
  }));
  const model = await listApplicationStudents();
  expect(model.students).toHaveLength(50);
  expect(model.hasMore).toBe(true);
  expect(mock.requireParent).toHaveBeenCalled();
  expect(mock.queries).toContainEqual({
    table: 'student_profiles',
    method: 'select',
    args: ['id,display_name,grade'],
  });
});
