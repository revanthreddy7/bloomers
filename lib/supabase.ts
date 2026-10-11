'use client';
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from './env';
import type { Database } from '@/types/database';
export function createBrowserClient() {
  const env = getPublicEnv();
  return createSSRBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
