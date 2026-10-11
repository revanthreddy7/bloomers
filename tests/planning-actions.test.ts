import { beforeEach, expect, it, vi } from 'vitest';
import sample from '@/supabase/fixtures/grade-8.json';
const mock = vi.hoisted(() => ({
  getStudent: vi.fn(),
  publication: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/server/identity/students', () => ({ getStudent: mock.getStudent }));
vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    throw new Error(`redirect:${target}`);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { enrollStudent } from '@/server/planning/actions';
function input() {
  const form = new FormData();
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  Object.entries({
    requestId: crypto.randomUUID(),
    versionId: '00000000-0000-0000-0000-000000000101',
    timezone: 'UTC',
    duration: '30',
    frequency: '2',
    time: '16:00',
    earliestDate: date.toISOString().slice(0, 10),
    parentId: 'forged',
    role: 'ADMIN',
  }).forEach(([key, value]) => form.set(key, value));
  form.append('weekdays', '1');
  form.append('weekdays', '3');
  return form;
}
const studentId = 'a3100000-0000-0000-0000-000000000001';
beforeEach(() => {
  vi.resetAllMocks();
  mock.publication.mockResolvedValue({
    data: { document: sample, status: 'published' },
    error: null,
  });
  mock.rpc.mockResolvedValue({ data: 'enrollment', error: null });
  mock.getStudent.mockResolvedValue({
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: mock.publication }) }),
        }),
      }),
      rpc: mock.rpc,
    },
  });
});
it('validates availability before invoking a database operation', async () => {
  const form = input();
  form.delete('weekdays');
  expect(await enrollStudent(studentId, {}, form)).toHaveProperty('error');
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('requires server-owned student authorization', async () => {
  mock.getStudent.mockRejectedValue(new Error('notFound'));
  await expect(enrollStudent(studentId, {}, input())).rejects.toThrow(
    'notFound',
  );
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('rejects unavailable publications before enrollment', async () => {
  mock.publication.mockResolvedValue({ data: null, error: null });
  expect(await enrollStudent(studentId, {}, input())).toEqual({
    error: 'Select an available published course.',
  });
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('accepts no parent, role, plan, mastery or publication status from the browser', async () => {
  await expect(enrollStudent(studentId, {}, input())).rejects.toThrow(
    `redirect:/parent/students/${studentId}/courses/enrollment`,
  );
  expect(mock.rpc.mock.calls[0][1]).toEqual(
    expect.objectContaining({
      p_student_id: studentId,
      p_version_id: '00000000-0000-0000-0000-000000000101',
    }),
  );
  expect(Object.keys(mock.rpc.mock.calls[0][1])).toEqual([
    'p_request_id',
    'p_student_id',
    'p_version_id',
    'p_preferences',
  ]);
});
it.each([
  ['23P01', 'overlaps'],
  ['P3003', 'already enrolled'],
  ['P3004', 'reviewed initialization'],
  ['42501', 'cannot enroll'],
])('surfaces %s safely', (code, message) => {
  mock.rpc.mockResolvedValue({
    error: { code, message: 'private database details' },
  });
  return expect(enrollStudent(studentId, {}, input())).resolves.toEqual({
    error: expect.stringContaining(message),
  });
});
it('does not expose raw database errors', async () => {
  mock.rpc.mockResolvedValue({
    error: { code: 'XX000', message: 'private database details' },
  });
  expect((await enrollStudent(studentId, {}, input())).error).not.toContain(
    'private',
  );
});
it('allows an identical persisted enrollment retry even when its original start date has passed', async () => {
  const form = input();
  form.set('earliestDate', '2020-01-01');
  await expect(enrollStudent(studentId, {}, form)).rejects.toThrow('redirect:');
  expect(mock.rpc).toHaveBeenCalled();
});
