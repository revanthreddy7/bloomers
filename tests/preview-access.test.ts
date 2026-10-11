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
    throw new Error('redirect:' + url);
  },
  notFound: () => {
    throw new Error('notFound');
  },
}));
import { requirePreview } from '@/server/application/preview';
import { requireParent } from '@/server/identity/parent';
beforeEach(() => {
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({
    data: { user: { id: 'parent', email_confirmed_at: 'now' } },
    error: null,
  });
  mock.rpc.mockResolvedValue({ data: 'selected', error: null });
});
it('redirects unauthenticated preview access', async () => {
  mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(requirePreview('selected')).rejects.toThrow(
    'redirect:/auth/sign-in',
  );
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('requires verified identity for preview', async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { email_confirmed_at: null } },
    error: null,
  });
  await expect(requirePreview('selected')).rejects.toThrow('verify-email');
});
it('rejects sibling and guessed preview contexts', async () => {
  await expect(requirePreview('sibling')).rejects.toThrow('notFound');
});
it('rejects preview URLs before explicit preview entry', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: null });
  await expect(requirePreview('selected')).rejects.toThrow('notFound');
});
it('fails closed when preview status cannot be verified', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } });
  await expect(requirePreview('selected')).rejects.toThrow(
    'could not be verified',
  );
});
it('returns no actor identity or session internals to preview consumers', async () => {
  const result = await requirePreview('selected');
  expect(Object.keys(result)).toEqual(['client']);
  expect(mock.rpc).toHaveBeenCalledWith('active_preview_student');
});
it('parent routes cannot escape an active preview', async () => {
  await expect(requireParent()).rejects.toThrow('redirect:/preview/selected');
  expect(mock.rpc).not.toHaveBeenCalledWith('provision_parent');
});
it('restores canonical parent provisioning only after preview exit', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: null });
  await expect(requireParent()).resolves.toHaveProperty('user');
  expect(mock.rpc).toHaveBeenCalledWith('provision_parent');
});
