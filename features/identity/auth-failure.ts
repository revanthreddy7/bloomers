export function transientAuthFailure(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { status?: unknown; name?: unknown };
  return (
    value.name === 'AuthRetryableFetchError' ||
    value.status === 0 ||
    (typeof value.status === 'number' && value.status >= 500)
  );
}
