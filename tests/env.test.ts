import { describe, expect, it } from 'vitest';
import { getPublicEnv, publicEnvSchema, serverEnvSchema } from '../lib/env';
import { afterEach, vi } from 'vitest';
it.each([
  'sb_secret_private-key',
  `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`,
])('rejects privileged keys in public configuration', (key) => {
  expect(
    publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
    }).success,
  ).toBe(false);
});
afterEach(() => vi.unstubAllEnvs());
it('returns validation failure for malformed URLs without throwing', () => {
  expect(
    publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test',
    }).success,
  ).toBe(false);
});
describe('environment validation', () => {
  it('rejects missing keys', () => {
    expect(publicEnvSchema.safeParse({}).success).toBe(false);
  });
  it('accepts valid values', () => {
    expect(
      publicEnvSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test',
      }).success,
    ).toBe(true);
  });
});
it.each(['replace-with-local-anon-key', '', '   ', 'ci-placeholder'])(
  'rejects unusable key %s',
  (key) => {
    expect(
      publicEnvSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
      }).success,
    ).toBe(false);
  },
);
it('rejects non-HTTP URLs', () => {
  expect(
    publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: 'ftp://example.com',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test',
    }).success,
  ).toBe(false);
});
it('reads only the named public variables', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'private');
  expect(getPublicEnv()).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
});
it('requires a real server key without requiring a browser key', () => {
  expect(
    serverEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'replace-with-local-service-role-key',
    }).success,
  ).toBe(false);
  expect(
    serverEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-server-key',
    }).success,
  ).toBe(true);
});
