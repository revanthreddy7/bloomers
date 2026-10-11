import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  recover: vi.fn(),
  resend: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/server/supabase-session', () => ({
  createSessionClient: async () => ({
    auth: {
      signUp: mock.signUp,
      signInWithPassword: mock.signIn,
      resetPasswordForEmail: mock.recover,
      resend: mock.resend,
      getUser: mock.getUser,
      updateUser: mock.updateUser,
      signOut: mock.signOut,
    },
    rpc: mock.rpc,
  }),
}));
vi.mock('@/server/identity/parent', () => ({
  requireParent: async () => ({
    client: { rpc: mock.rpc },
    user: { id: 'trusted' },
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    throw new Error(`redirect:${target}`);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import {
  authenticate,
  resetPassword,
  saveStudent,
  saveConsent,
  signOut,
} from '@/server/identity/actions';
function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.signUp.mockResolvedValue({ error: null });
  mock.signIn.mockResolvedValue({ error: null });
  mock.recover.mockResolvedValue({ error: null });
  mock.resend.mockResolvedValue({ error: null });
  mock.signOut.mockResolvedValue({ error: null });
  mock.updateUser.mockResolvedValue({ error: null });
  mock.getUser.mockResolvedValue({
    data: { user: { id: 'trusted', email_confirmed_at: 'now' } },
    error: null,
  });
});
it('signup accepts no caller role and sends verification', async () => {
  await expect(
    authenticate(
      'sign-up',
      {},
      form({
        email: 'test@example.test',
        password: 'long-unique-password',
        role: 'ADMIN',
      }),
    ),
  ).rejects.toThrow('redirect:/auth/verify-email');
  expect(mock.signUp).toHaveBeenCalledWith(
    expect.objectContaining({
      email: 'test@example.test',
      password: 'long-unique-password',
    }),
  );
  expect(mock.signUp.mock.calls[0][0].options).not.toHaveProperty('data');
});
it('sign-in rejects external redirect destinations', async () => {
  await expect(
    authenticate(
      'sign-in',
      {},
      form({
        email: 'test@example.test',
        password: 'password',
        next: 'https://evil.test',
      }),
    ),
  ).rejects.toThrow('redirect:/parent');
});
it('does not expose upstream authentication errors', async () => {
  mock.signIn.mockResolvedValue({
    error: { message: 'email exists, private details' },
  });
  expect(
    (
      await authenticate(
        'sign-in',
        {},
        form({ email: 'test@example.test', password: 'password' }),
      )
    ).error,
  ).not.toContain('private');
});
it('recovery responses do not enumerate accounts', async () => {
  mock.recover.mockResolvedValue({ error: { message: 'user not found' } });
  expect(
    await authenticate(
      'forgot-password',
      {},
      form({ email: 'unknown@example.test' }),
    ),
  ).toHaveProperty('message');
});
it('expired sessions cannot reset passwords', async () => {
  mock.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'expired' },
  });
  expect(
    await resetPassword(
      {},
      form({
        password: 'new-long-password',
        confirmPassword: 'new-long-password',
      }),
    ),
  ).toHaveProperty('error');
  expect(mock.updateUser).not.toHaveBeenCalled();
});
it('successful recovery changes only authenticated user and revokes sessions', async () => {
  await expect(
    resetPassword(
      {},
      form({
        password: 'new-long-password',
        confirmPassword: 'new-long-password',
        userId: 'someone-else',
      }),
    ),
  ).rejects.toThrow('redirect:/auth/sign-in?password=updated');
  expect(mock.updateUser).toHaveBeenCalledWith({
    password: 'new-long-password',
  });
  expect(mock.signOut).toHaveBeenCalledWith({ scope: 'global' });
});
it('does not claim sign-out succeeded when auth fails', async () => {
  mock.signOut.mockResolvedValue({ error: { message: 'network' } });
  await expect(signOut()).rejects.toThrow('Sign-out did not complete');
});
it('student creation uses request UUID without actor or user IDs', async () => {
  const id = crypto.randomUUID();
  mock.rpc.mockResolvedValue({ data: id, error: null });
  await expect(
    saveStudent(
      null,
      {},
      form({
        displayName: 'Alex',
        grade: '8',
        requestId: crypto.randomUUID(),
        parentId: 'forged',
        user_id: 'forged',
        role: 'ADMIN',
      }),
    ),
  ).rejects.toThrow(`redirect:/parent/students/${id}`);
  expect(mock.rpc.mock.calls[0][1]).not.toHaveProperty('parentId');
  expect(mock.rpc.mock.calls[0][1]).not.toHaveProperty('user_id');
});
it('unauthorized student edits return a usable error', async () => {
  mock.rpc.mockResolvedValue({ error: { code: '42501' } });
  expect(
    await saveStudent(
      crypto.randomUUID(),
      {},
      form({ displayName: 'Alex', grade: '8' }),
    ),
  ).toHaveProperty('error');
});
it('records consent withdrawal with a validated category and request', async () => {
  mock.rpc.mockResolvedValue({ error: null });
  expect(
    await saveConsent(
      {},
      form({
        requestId: crypto.randomUUID(),
        studentId: crypto.randomUUID(),
        consentType: 'microphone',
        policyVersion: 'draft-v1',
        granted: 'false',
      }),
    ),
  ).toEqual({ message: 'Consent withdrawal recorded.' });
  expect(mock.rpc.mock.calls[0][1].p_granted).toBe(false);
});
it('rejects unapproved grants without exposing database details', async () => {
  mock.rpc.mockResolvedValue({
    error: { code: '22023', message: 'sql details' },
  });
  expect(
    (
      await saveConsent(
        {},
        form({
          requestId: crypto.randomUUID(),
          studentId: crypto.randomUUID(),
          consentType: 'microphone',
          policyVersion: 'draft-v1',
          granted: 'true',
        }),
      )
    ).error,
  ).toContain('not approved');
});
