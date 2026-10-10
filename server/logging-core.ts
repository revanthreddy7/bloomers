import { z } from 'zod';

// Explicit allowlist: never accept arbitrary payloads, prompts, JWTs, names,
// media, student answers, or error messages from upstream services.
const logSchema = z
  .object({
    level: z.enum(['info', 'warn', 'error']),
    event: z.enum([
      'request_completed',
      'operation_failed',
      'foundation_ready',
    ]),
    requestId: z.uuid().optional(),
    durationMs: z.number().nonnegative().optional(),
    status: z.number().int().min(100).max(599).optional(),
  })
  .strict();

export function createLogger(write: (entry: Record<string, unknown>) => void) {
  return (entry: z.infer<typeof logSchema>) => {
    const safe = logSchema.parse(entry);
    write({ ...safe, timestamp: new Date().toISOString() });
  };
}
