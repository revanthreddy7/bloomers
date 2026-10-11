import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/supabase-session', () => ({
  createSessionClient: async () => ({
    auth: { signInWithPassword: async () => ({ error: null }) },
    rpc: mock.rpc,
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    throw new Error(`redirect:${target}`);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { authenticate } from '@/server/identity/actions';
beforeEach(() => vi.resetAllMocks());
const credentials = () => {
  const form = new FormData();
  form.set('email', 'synthetic@example.test');
  form.set('password', 'local-password');
  form.set('role', 'ADMIN');
  return form;
};
it('routes a canonically verified academic administrator to the explorer', async () => {
  mock.rpc.mockResolvedValue({ data: true, error: null });
  await expect(authenticate('sign-in', {}, credentials())).rejects.toThrow(
    'redirect:/curriculum',
  );
  expect(mock.rpc).toHaveBeenCalledWith('is_academic_admin');
});
it('ignores a caller ADMIN label when canonical authorization is false', async () => {
  mock.rpc.mockResolvedValue({ data: false, error: null });
  await expect(authenticate('sign-in', {}, credentials())).rejects.toThrow(
    'redirect:/parent',
  );
});
