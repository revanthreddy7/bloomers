'use client';
import { createClient } from '@supabase/supabase-js';
import { getPublicEnv } from './env';
import type { Database } from '@/types/database';
export function createBrowserClient() {
  const env = getPublicEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
