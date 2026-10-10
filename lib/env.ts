import { z } from 'zod';
const key = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !value.startsWith('replace-with-') && value !== 'ci-placeholder',
    'Use an actual key from Supabase, not the example placeholder',
  );
const url = z.url().refine((value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, 'Use an HTTP(S) Supabase URL');
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: key.refine((value) => {
    if (value.startsWith('sb_secret_')) return false;
    try {
      const payload = value.split('.')[1];
      if (!payload) return true;
      const decoded = JSON.parse(
        atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
      );
      return decoded.role !== 'service_role';
    } catch {
      return true;
    }
  }, 'Privileged Supabase keys must never be used in public environment variables'),
});
export const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
});
export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
