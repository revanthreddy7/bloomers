import { beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const mock = vi.hoisted(() => ({
  getStudent: vi.fn(),
  rpc: vi.fn(),
  queries: [] as { method: string; args: unknown[] }[],
  row: null as null | { id: string },
}));
vi.mock('server-only', () => ({}));
vi.mock('@/server/identity/students', () => ({ getStudent: mock.getStudent }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));
import { mutateClassroom, readClassroom } from '@/server/classroom/service';
const scheduleId = randomUUID(),
  studentId = randomUUID();
beforeEach(() => {
  vi.resetAllMocks();
  mock.queries = [];
  mock.row = { id: scheduleId };
  const client = {
    rpc: mock.rpc,
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'eq'])
        chain[method] = (...args: unknown[]) => {
          mock.queries.push({ method, args });
          return chain;
        };
      chain.maybeSingle = async () => ({ data: mock.row, error: null });
      return chain;
    },
  };
  mock.getStudent.mockResolvedValue({ client });
  mock.rpc.mockResolvedValue({ data: randomUUID(), error: null });
});
it('requires explicit selected-student preview before any mutation', async () => {
  mock.getStudent.mockRejectedValue(new Error('preview denied'));
  await expect(
    mutateClassroom(
      studentId,
      scheduleId,
      { commandId: randomUUID(), action: 'start' },
      'lifecycle',
    ),
  ).rejects.toThrow('preview denied');
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('checks reservation ownership without accepting actor IDs', async () => {
  await mutateClassroom(
    studentId,
    scheduleId,
    { commandId: randomUUID(), action: 'start' },
    'lifecycle',
  );
  expect(mock.getStudent).toHaveBeenCalledWith(studentId, 'preview');
  expect(mock.queries).toContainEqual({
    method: 'eq',
    args: ['student_id', studentId],
  });
  expect(mock.rpc.mock.calls[0][1]).not.toHaveProperty('parent_id');
});
it('rejects foreign or unavailable reservation without calling privileged operation', async () => {
  mock.row = null;
  expect(
    await mutateClassroom(
      studentId,
      scheduleId,
      { commandId: randomUUID(), action: 'start' },
      'lifecycle',
    ),
  ).toHaveProperty('error');
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('rejects untrusted source or role extensions', async () => {
  expect(
    await mutateClassroom(
      studentId,
      scheduleId,
      { commandId: randomUUID(), action: 'start', role: 'ADMIN' },
      'lifecycle',
    ),
  ).toHaveProperty('error');
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('passes only validated scoped whiteboard commands', async () => {
  const commandId = randomUUID();
  await mutateClassroom(
    studentId,
    scheduleId,
    {
      commandId,
      expectedEpoch: 3,
      command: { kind: 'clear_board', payload: { confirmed: true } },
    },
    'append',
  );
  expect(mock.rpc).toHaveBeenCalledWith('classroom_append', {
    p_schedule_id: scheduleId,
    p_request_id: commandId,
    p_epoch: 3,
    p_command: { kind: 'clear_board', payload: { confirmed: true } },
  });
});
it.each([
  ['P5002', 'Classroom event limit'],
  ['P5003', 'history is full'],
  ['P5001', 'other open classroom'],
  ['40001', 'lesson changed'],
  ['42501', 'unavailable'],
])('curates database errors %s', async (code, message) => {
  mock.rpc.mockResolvedValue({
    error: { code, message: 'sensitive database context' },
  });
  const result = await mutateClassroom(
    studentId,
    scheduleId,
    { commandId: randomUUID(), action: 'start' },
    'lifecycle',
  );
  expect(result.error).toContain(message);
  expect(result.error).not.toContain('sensitive');
});
it('replay hides unavailable students/lessons and validates protocol output', async () => {
  mock.row = null;
  await expect(readClassroom(studentId, scheduleId, 0)).rejects.toThrow(
    'notFound',
  );
  mock.row = { id: scheduleId };
  mock.rpc.mockResolvedValue({
    data: { lesson: null, events: [{ protocolVersion: 2 }] },
    error: null,
  });
  await expect(readClassroom(studentId, scheduleId, 0)).rejects.toThrow();
});

it('does not acknowledge a drawing when inactivity reconciles abandonment', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: null });
  const result = await mutateClassroom(
    studentId,
    scheduleId,
    {
      commandId: randomUUID(),
      expectedEpoch: 0,
      command: { kind: 'clear_board', payload: { confirmed: true } },
    },
    'append',
  );
  expect(result.error).toContain('abandoned');
});
