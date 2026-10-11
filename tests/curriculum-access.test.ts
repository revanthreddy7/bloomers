import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ getUser: vi.fn(), role: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('react', () => ({ cache: (fn: unknown) => fn }));
vi.mock('@/server/supabase-session', () => ({
  createSessionClient: async () => ({
    auth: { getUser: mock.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mock.role }) }),
    }),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
import {
  requireAcademicReader,
  requireAcademicAdmin,
} from '@/server/curriculum/access';
beforeEach(() => {
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({
    data: {
      user: {
        id: 'id',
        email_confirmed_at: 'now',
        user_metadata: { role: 'ADMIN' },
      },
    },
    error: null,
  });
});
it('rejects missing sessions before reading roles', async () => {
  mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(requireAcademicReader()).rejects.toThrow('sign-in');
  expect(mock.role).not.toHaveBeenCalled();
});
it('rejects unverified identities', async () => {
  mock.getUser.mockResolvedValue({ data: { user: { id: 'id' } }, error: null });
  await expect(requireAcademicReader()).rejects.toThrow('verify-email');
});
it('permits parent reads but ignores ADMIN metadata for writes', async () => {
  mock.role.mockResolvedValue({ data: { role: 'PARENT' }, error: null });
  expect((await requireAcademicReader()).role).toBe('PARENT');
  await expect(requireAcademicAdmin()).rejects.toThrow(
    'administrator required',
  );
});
it('requires a canonical admin for trusted mutations', async () => {
  mock.role.mockResolvedValue({ data: { role: 'ADMIN' }, error: null });
  expect((await requireAcademicAdmin()).role).toBe('ADMIN');
});
it('denies student and missing application roles', async () => {
  mock.role.mockResolvedValue({ data: { role: 'STUDENT' }, error: null });
  await expect(requireAcademicReader()).rejects.toThrow('access-denied');
  mock.role.mockResolvedValue({ data: null, error: null });
  await expect(requireAcademicReader()).rejects.toThrow('access-denied');
});
it('fails closed on a role lookup error', async () => {
  mock.role.mockResolvedValue({
    data: { role: 'ADMIN' },
    error: { code: 'unavailable' },
  });
  await expect(requireAcademicAdmin()).rejects.toThrow(
    'verify academic access',
  );
});
