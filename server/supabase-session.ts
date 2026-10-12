import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicEnv } from '@/lib/env';
import type { Database } from '@/types/database';
import { timedBackendFetch } from '@/server/observability/enrollment';

export async function createSessionClient() {
  const store = await cookies();
  const env = getPublicEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { fetch: timedBackendFetch() },
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Server components cannot write cookies; middleware owns refresh. */
          }
        },
      },
    },
  );
}
