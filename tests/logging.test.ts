import { expect, it, vi } from 'vitest';
import { createLogger } from '../server/logging-core';

it('emits structured operational metadata', () => {
  const write = vi.fn();
  createLogger(write)({
    level: 'info',
    event: 'request_completed',
    durationMs: 20,
    status: 200,
  });
  expect(write).toHaveBeenCalledWith(
    expect.objectContaining({
      level: 'info',
      durationMs: 20,
      timestamp: expect.any(String),
    }),
  );
});
it('rejects sensitive arbitrary fields before writing', () => {
  const write = vi.fn();
  const log = createLogger(write);
  // Verify runtime validation protects against untyped callers too.
  expect(() =>
    log({
      level: 'error',
      event: 'operation_failed',
      token: 'secret',
    } as unknown as Parameters<typeof log>[0]),
  ).toThrow();
  expect(write).not.toHaveBeenCalled();
});
