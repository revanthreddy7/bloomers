import { z } from 'zod';
const usageSchema = z.strictObject({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCents: z.number().finite().nonnegative(),
});
// A local ledger is useful telemetry, not proof of a provider spending cap.
export class SessionBudget {
  private spent = 0;
  private operations = 0;
  private stopped = false;
  constructor(
    private readonly startedAt: number,
    private readonly durationMs: number,
    private readonly maxCents: number,
    private readonly capVerified: boolean,
  ) {
    if (
      ![startedAt, durationMs, maxCents].every(Number.isFinite) ||
      durationMs <= 0 ||
      durationMs > 300000 ||
      maxCents <= 0
    )
      throw new Error('Invalid budget.');
  }
  authorize(now: number, estimatedCents: number | null) {
    if (
      this.stopped ||
      !this.capVerified ||
      !Number.isFinite(now) ||
      now < this.startedAt ||
      now - this.startedAt >= this.durationMs ||
      estimatedCents === null ||
      !Number.isFinite(estimatedCents) ||
      estimatedCents < 0 ||
      this.spent + estimatedCents > this.maxCents ||
      this.operations >= 20
    ) {
      this.stopped = true;
      throw new Error('Session budget cannot authorize usage.');
    }
    this.spent += estimatedCents;
    this.operations++;
  }
  recordUsage(value: unknown) {
    return usageSchema.parse(value);
  }
  stop() {
    this.stopped = true;
  }
  get telemetry() {
    return {
      reservedEstimatedCents: this.spent,
      operations: this.operations,
      stopped: this.stopped,
      providerCapVerified: this.capVerified,
    };
  }
}
