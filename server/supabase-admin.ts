import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnvSchema } from '@/lib/env';
import type { Database } from '@/types/database';
// This client bypasses RLS. Future callers must authorize the actor and target
// before calling it; it must never be passed into a client component.
export function createAdminClient() {
  const env = serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
