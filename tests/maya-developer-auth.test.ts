import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/server/supabase-session', () => ({
  createSessionClient: async () => ({
    auth: { getUser: mock.getUser, getClaims: mock.getClaims },
    rpc: mock.rpc,
  }),
}));
import { authorizeDeveloper } from '@/server/maya/developer-auth';
const id = '65000000-0000-4000-8000-000000000001',
  session = '65000000-0000-4000-8000-000000000002';
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('MAYA_DEV_USER_IDS', id);
  vi.stubEnv('MAYA_DEV_ORIGIN', 'http://localhost:3000');
  mock.getUser.mockResolvedValue({
    data: { user: { id, email_confirmed_at: 'verified' } },
    error: null,
  });
  mock.getClaims.mockResolvedValue({
    data: { claims: { sub: id, session_id: session } },
    error: null,
  });
  mock.rpc.mockImplementation(async (name: string) => ({
    data: name === 'is_current_auth_session_active' ? true : null,
    error: null,
  }));
});
afterEach(() => vi.unstubAllEnvs());
it('binds operator-authorized identity to verified Auth subject and signed session', async () => {
  await expect(authorizeDeveloper('http://localhost:3000')).resolves.toEqual({
    userId: id,
    authSessionId: session,
  });
});
it('ordinary parent/admin identity metadata cannot authorize developer access', async () => {
  vi.stubEnv('MAYA_DEV_USER_IDS', '');
  mock.getUser.mockResolvedValue({
    data: {
      user: {
        id,
        email_confirmed_at: 'verified',
        user_metadata: { role: 'ADMIN', developer: true },
      },
    },
  });
  await expect(authorizeDeveloper('http://localhost:3000')).rejects.toThrow(
    'allowlisted',
  );
});
it('production is denied before any authentication request', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  await expect(authorizeDeveloper('http://localhost:3000')).rejects.toThrow(
    'Development only',
  );
  expect(mock.getUser).not.toHaveBeenCalled();
});
it('unverified or mismatched users and claims cannot acquire access', async () => {
  mock.getUser.mockResolvedValueOnce({
    data: { user: { id, email_confirmed_at: null } },
  });
  await expect(authorizeDeveloper('http://localhost:3000')).rejects.toThrow(
    'Verified',
  );
  mock.getClaims.mockResolvedValueOnce({
    data: { claims: { sub: crypto.randomUUID(), session_id: session } },
    error: null,
  });
  await expect(authorizeDeveloper('http://localhost:3000')).rejects.toThrow(
    'Verified Auth session',
  );
});
it('selected student preview and scope lookup failures remain denied', async () => {
  mock.rpc.mockResolvedValueOnce({ data: true, error: null });
  mock.rpc.mockResolvedValueOnce({ data: id, error: null });
  await expect(authorizeDeveloper('http://localhost:3000')).rejects.toThrow(
    'Supervised preview',
  );
  mock.rpc.mockResolvedValueOnce({ data: true, error: null });
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
  await expect(authorizeDeveloper('http://localhost:3000')).rejects.toThrow(
    'Supervised preview',
  );
});
it('deleted or expired retained Auth sessions are denied independently of a valid JWT', async () => {
  mock.rpc.mockResolvedValueOnce({ data: false, error: null });
  await expect(authorizeDeveloper('http://localhost:3000')).rejects.toThrow(
    'retained Auth session',
  );
});
