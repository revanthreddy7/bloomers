import 'server-only';
type Stage =
  | 'student_authorization'
  | 'publication_read'
  | 'enrollment_transaction'
  | 'auth_user'
  | 'auth_refresh'
  | 'auth_token'
  | 'auth_claims'
  | 'database_rpc'
  | 'other_backend';
function enabled() {
  if (process.env.ENROLLMENT_TRACE !== '1') return false;
  try {
    return ['localhost', '127.0.0.1'].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname,
    );
  } catch {
    return false;
  }
}
export async function measureEnrollment<T>(
  stage: Stage,
  operation: () => PromiseLike<T>,
): Promise<T> {
  const began = performance.now();
  try {
    const result = await operation();
    if (enabled())
      console.info(
        JSON.stringify({
          event: 'local_enrollment_timing',
          stage,
          durationMs: Math.round(performance.now() - began),
          outcome: 'returned',
        }),
      );
    return result;
  } catch (error) {
    if (enabled())
      console.info(
        JSON.stringify({
          event: 'local_enrollment_timing',
          stage,
          durationMs: Math.round(performance.now() - began),
          outcome: 'threw',
        }),
      );
    throw error;
  }
}
export function timedBackendFetch(
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL
        ? input.toString()
        : input.url,
    );
    const stage: Stage =
      url.pathname === '/auth/v1/user'
        ? 'auth_user'
        : url.pathname === '/auth/v1/token'
          ? url.searchParams.get('grant_type') === 'refresh_token'
            ? 'auth_refresh'
            : 'auth_token'
          : url.pathname.includes('/.well-known/')
            ? 'auth_claims'
            : url.pathname.startsWith('/rest/v1/rpc/')
              ? 'database_rpc'
              : 'other_backend';
    const began = performance.now();
    const response = await measureEnrollment(stage, () =>
      baseFetch(input, init),
    );
    if (enabled())
      console.info(
        JSON.stringify({
          event: 'local_backend_status',
          stage,
          status: response.status,
          durationMs: Math.round(performance.now() - began),
        }),
      );
    return response;
  };
}
