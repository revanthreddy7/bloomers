import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('react', () => ({ cache: (fn: unknown) => fn }));
vi.mock('@/server/supabase-session', () => ({
  createSessionClient: async () => ({
    auth: { getUser: mock.getUser },
    rpc: mock.rpc,
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
import { requireParent } from '@/server/identity/parent';
beforeEach(() => vi.resetAllMocks());
it('protects routes when session expires', async () => {
  mock.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'expired' },
  });
  await expect(requireParent()).rejects.toThrow('redirect:/auth/sign-in');
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('unverified identities cannot provision parent records', async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: 'id', email_confirmed_at: null } },
    error: null,
  });
  await expect(requireParent()).rejects.toThrow('redirect:/auth/verify-email');
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('validates parent role through trusted provisioning', async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: 'id', email_confirmed_at: 'now' } },
    error: null,
  });
  mock.rpc.mockResolvedValue({ error: { code: '42501' } });
  await expect(requireParent()).rejects.toThrow('redirect:/auth/access-denied');
});
it('retries transient provisioning failures instead of pretending success', async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: 'id', email_confirmed_at: 'now' } },
    error: null,
  });
  mock.rpc.mockResolvedValue({ error: { code: 'XX000' } });
  await expect(requireParent()).rejects.toThrow('could not be prepared');
});
