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
import { transientAuthFailure } from '@/features/identity/auth-failure';
import {
  timedBackendFetch,
  measureEnrollment,
} from '@/server/observability/enrollment';
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it.each([{ status: 503 }, { status: 0 }, { name: 'AuthRetryableFetchError' }])(
  'does not bounce temporary authentication failure %j through sign-in',
  async (error) => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error });
    await expect(requireParent()).rejects.toThrow('temporarily unavailable');
    expect(mock.rpc).not.toHaveBeenCalled();
  },
);
it('still denies invalid authentication without trusting local cookie data', async () => {
  mock.getUser.mockResolvedValue({
    data: { user: null },
    error: { status: 401 },
  });
  await expect(requireParent()).rejects.toThrow('redirect:/auth/sign-in');
  expect(transientAuthFailure({ status: 403 })).toBe(false);
});
it('timing instrumentation records no URL, identity, headers, body, secret or error messages', async () => {
  vi.stubEnv('ENROLLMENT_TRACE', '1');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const fake = vi.fn(async () => new Response('{}', { status: 200 }));
  await timedBackendFetch(fake)(
    'http://localhost:54321/auth/v1/user?secret=do-not-log',
    { headers: { Authorization: 'sensitive' } },
  );
  await expect(
    measureEnrollment('enrollment_transaction', async () => {
      throw new Error('private-details');
    }),
  ).rejects.toThrow('private-details');
  const logged = JSON.stringify(info.mock.calls);
  expect(logged).toContain('auth_user');
  expect(logged).not.toMatch(
    /do-not-log|sensitive|private-details|localhost|Authorization/,
  );
  info.mockRestore();
});
it('logging remains off for hosted backends or an absent opt-in flag', async () => {
  vi.stubEnv('ENROLLMENT_TRACE', '1');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://remote.example');
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  await measureEnrollment('publication_read', async () => 1);
  expect(info).not.toHaveBeenCalled();
  info.mockRestore();
});
it('separates password/token exchange from actual session refresh without logging token values', async () => {
  vi.stubEnv('ENROLLMENT_TRACE', '1');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
  const info = vi.spyOn(console, 'info').mockImplementation(() => {}),
    fake = vi.fn(async () => new Response('{}'));
  await timedBackendFetch(fake)(
    'http://localhost:54321/auth/v1/token?grant_type=password',
  );
  await timedBackendFetch(fake)(
    'http://localhost:54321/auth/v1/token?grant_type=refresh_token',
  );
  const logs = info.mock.calls.map(([line]) => JSON.parse(line as string));
  expect(logs.some((row) => row.stage === 'auth_token')).toBe(true);
  expect(logs.some((row) => row.stage === 'auth_refresh')).toBe(true);
  expect(JSON.stringify(logs)).not.toContain('grant_type');
  info.mockRestore();
});
