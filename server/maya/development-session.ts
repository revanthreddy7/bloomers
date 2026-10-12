import 'server-only';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, open, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  developerEventSchema,
  developerSnapshotSchema,
  developmentStepSchema,
  stepAction,
  type DeveloperSnapshot,
  type DevelopmentStep,
} from '@/features/maya/development';
import { mayaCommandSchema } from '@/features/classroom/protocol';
import { approvalSchema, type DeveloperIdentity } from './developer-auth';
import type {
  DevelopmentConnection,
  DevelopmentTransport,
} from './development-transport';

export interface DevelopmentStore {
  claim(approvalId: string): Promise<void>;
  save(snapshot: DeveloperSnapshot, callId: string | null): Promise<void>;
  release(): Promise<void>;
}
export function diskDevelopmentStore(root = process.cwd()): DevelopmentStore {
  const dir = join(root, '.local', 'maya');
  return {
    async claim(id) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const lock = await open(join(dir, 'active.lock'), 'wx', 0o600);
      await lock.close();
      try {
        const used = await open(join(dir, `approval-${id}.used`), 'wx', 0o600);
        await used.close();
      } catch (error) {
        await unlink(join(dir, 'active.lock'));
        throw error;
      }
    },
    async save(snapshot, callId) {
      await writeFile(
        join(dir, `${snapshot.id}.json`),
        JSON.stringify({ snapshot, callId }),
        { mode: 0o600 },
      );
    },
    async release() {
      await unlink(join(dir, 'active.lock'));
    },
  };
}
type Pending = {
  turnId: string;
  responseId: string;
  epoch: number;
  step: DevelopmentStep;
  proposedAt: number;
};
export class DevelopmentSession {
  readonly id = randomUUID();
  private readonly startedAt: number;
  private stopAt: number;
  private events: DeveloperSnapshot['events'] = [];
  private epoch = 0;
  private status: DeveloperSnapshot['status'] = 'active';
  private pending: Pending | null = null;
  private connection: DevelopmentConnection | null = null;
  private callId: string | null = null;
  private attempted = false;
  private stopping: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat: number;
  private lastRequestAt: number;
  private responses = new Set<string>();
  private calls = new Set<string>();
  private completed = new Map<string, { responseId: string; epoch: number }>();
  private acceptedSteps = new Set<string>();
  private turns = 0;
  private activeResponse: string | null = null;
  private awaitingResponse = false;
  private requestedEpoch = 0;
  private responseEpochs = new Map<string, number>();
  private audioStarted = new Map<string, number>();
  private queuedResponse: { instructions: string; speakOnly: boolean } | null =
    null;
  private queue = Promise.resolve();
  private metric: DeveloperSnapshot['metrics'] = {
    durationMs: 0,
    firstAudioMs: null,
    boardLatencyMs: [],
    coordinationDelayMs: [],
    interruptionMs: [],
    responseLatencyMs: [],
    staleRejected: 0,
    failures: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCents: 0,
    usageComplete: false,
    terminationConfirmed: false,
  };
  constructor(
    readonly identity: DeveloperIdentity,
    private readonly approval: z.infer<typeof approvalSchema>,
    private readonly transport: DevelopmentTransport,
    private readonly store: DevelopmentStore,
    private readonly now: () => number = Date.now,
  ) {
    this.startedAt = now();
    this.lastHeartbeat = now();
    this.lastRequestAt = now();
    this.stopAt = Math.min(
      now() + approval.durationSeconds * 1000,
      Date.parse(approval.expiresAt),
    );
  }
  private event(
    kind: DeveloperSnapshot['events'][number]['kind'],
    payload: Record<string, unknown> = {},
  ) {
    this.events.push(
      developerEventSchema.parse({
        id: randomUUID(),
        lessonId: this.id,
        sequence: this.events.length + 1,
        epoch: this.epoch,
        protocolVersion: 1,
        source: 'maya_development',
        kind,
        payload,
        createdAt: new Date(this.now()).toISOString(),
      }),
    );
  }
  snapshot(): DeveloperSnapshot {
    return developerSnapshotSchema.parse({
      id: this.id,
      status: this.status,
      epoch: this.epoch,
      stopAt: this.stopAt,
      events: this.events,
      pending: this.pending?.responseId
        ? {
            turnId: this.pending.turnId,
            responseId: this.pending.responseId,
            epoch: this.pending.epoch,
          }
        : null,
      metrics: {
        ...this.metric,
        durationMs: Math.max(
          0,
          Math.min(this.now(), this.stopAt) - this.startedAt,
        ),
      },
    });
  }
  private async save() {
    await this.store.save(this.snapshot(), this.callId);
  }
  async run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  async start(sdp: string) {
    await this.store.claim(this.approval.approvalId);
    this.event('started', {
      fixture: this.approval.fixture,
      model: this.approval.model,
      policyVersion: 'maya-adult-dev-1',
      approvedBudgetCents: this.approval.budgetCents,
    });
    await this.save();
    this.timer = setInterval(() => {
      void this.run(() => this.tick()).catch(() =>
        this.stop('provider_failure'),
      );
    }, 1000);
    try {
      this.attempted = true;
      const result = await this.transport.create(sdp);
      this.callId = result.callId;
      await this.save();
      if (this.status !== 'active' || this.now() >= this.stopAt) {
        await this.transport.hangup(result.callId);
        throw new Error('Setup expired.');
      }
      this.connection = await this.transport.attach(
        result.callId,
        (event) => {
          this.queue = this.queue
            .then(() => this.providerEvent(event))
            .catch(() => this.stop('provider_failure'));
        },
        () => {
          void this.stop('provider_failure');
        },
      );
      if (this.status !== 'active') {
        this.connection.close();
        throw new Error('Setup interrupted.');
      }
      this.requestResponse(
        'Greet the adult tester briefly, state the objective, and propose the equation step through teach_step.',
      );
      return { sdp: result.sdp, snapshot: this.snapshot() };
    } catch {
      await this.stop('provider_failure');
      throw new Error(
        'Controlled provider connection failed; no automatic retry. Review local termination status.',
      );
    }
  }
  private requestResponse(instructions: string, speakOnly = false) {
    if (this.status !== 'active') return;
    if (this.activeResponse || this.awaitingResponse) {
      this.queuedResponse = { instructions, speakOnly };
      return;
    }
    if (++this.turns > 8) {
      void this.stop('ended');
      return;
    }
    this.awaitingResponse = true;
    this.requestedEpoch = this.epoch;
    this.lastRequestAt = this.now();
    this.connection?.send({
      type: 'response.create',
      response: {
        instructions,
        max_output_tokens: 256,
        tool_choice: speakOnly ? 'none' : 'auto',
      },
    });
  }
  private async providerEvent(raw: unknown) {
    if (this.status !== 'active') return;
    if (this.events.length >= 180) return this.stop('ended');
    const event = z.object({ type: z.string().max(100) }).parse(raw);
    if (event.type === 'error' || event.type === 'session.updated')
      return this.stop('provider_failure');
    if (event.type === 'response.created') {
      const created = z
        .object({ response: z.object({ id: z.string().max(200) }) })
        .parse(raw);
      if (!this.awaitingResponse || this.responseEpochs.size >= 8)
        return this.stop('provider_failure');
      this.awaitingResponse = false;
      this.activeResponse = created.response.id;
      this.responseEpochs.set(created.response.id, this.requestedEpoch);
      if (this.requestedEpoch !== this.epoch)
        this.connection?.send({ type: 'response.cancel' });
      else if (this.pending && !this.pending.responseId)
        this.pending.responseId = created.response.id;
    } else if (event.type === 'response.function_call_arguments.done') {
      const call = z
        .object({
          name: z.string().max(100),
          call_id: z.string().max(200),
          response_id: z.string().max(200),
          arguments: z.string().max(2000),
        })
        .parse(raw);
      if (this.calls.has(call.call_id)) return;
      if (this.responseEpochs.get(call.response_id) !== this.epoch) {
        this.metric.staleRejected++;
        this.event('tool_rejected', { reason: 'stale_generation' });
        await this.save();
        return;
      }
      this.calls.add(call.call_id);
      this.event('tool_proposed', {
        callId: call.call_id,
        name: call.name === 'teach_step' ? 'teach_step' : 'unapproved',
      });
      const parsed =
        call.name === 'teach_step'
          ? developmentStepSchema.safeParse(JSON.parse(call.arguments))
          : null;
      const step = parsed?.success ? parsed.data : null;
      const prerequisites =
        step?.step === 'subtract'
          ? ['equation']
          : step?.step === 'divide'
            ? ['subtract']
            : step?.step === 'check'
              ? ['divide']
              : [];
      if (
        !step ||
        this.pending ||
        prerequisites.some((s) => !this.acceptedSteps.has(s))
      ) {
        this.event('tool_rejected', { callId: call.call_id });
        this.connection?.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({
              accepted: false,
              reason:
                'Invalid, pending, or out-of-order step. Use actual board state.',
              board: [...this.acceptedSteps],
            }),
          },
        });
        this.requestResponse(
          'The proposal was rejected. Briefly clarify using the actual board; do not assume the rejected step was applied.',
        );
      } else {
        this.pending = {
          turnId: randomUUID(),
          responseId: '',
          epoch: this.epoch,
          step,
          proposedAt: this.now(),
        };
        this.event('tool_validated', {
          callId: call.call_id,
          turnId: this.pending.turnId,
          step: step.step,
        });
        this.connection?.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({
              accepted: true,
              board: [...this.acceptedSteps],
              instruction:
                'Speak the validated narration and question, then wait.',
            }),
          },
        });
        this.requestResponse(
          `Speak this short teaching narration, then its question and wait for the adult response: ${step.narration}\n${step.question ?? ''}`,
          true,
        );
      }
    } else if (event.type === 'input_audio_buffer.speech_started') {
      await this.interrupt();
    } else if (event.type === 'input_audio_buffer.committed') {
      this.requestResponse(
        `Respond to the adult's latest spoken turn. Current committed board steps: ${JSON.stringify([...this.acceptedSteps])}. Check reasoning, hint before revealing. Use teach_step if a board explanation is helpful.`,
      );
    } else if (event.type === 'response.done') {
      const done = z
        .object({
          response: z.object({
            id: z.string(),
            usage: z
              .object({
                input_tokens: z.number().int().nonnegative(),
                output_tokens: z.number().int().nonnegative(),
              })
              .nullable()
              .optional(),
          }),
        })
        .parse(raw);
      if (this.responses.has(done.response.id)) return;
      this.responses.add(done.response.id);
      if (this.activeResponse === done.response.id) this.activeResponse = null;
      if (!done.response.usage) return this.stop('provider_failure');
      this.metric.usageComplete = true;
      this.metric.inputTokens += done.response.usage.input_tokens;
      this.metric.outputTokens += done.response.usage.output_tokens;
      // Conservative estimate: charge all inputs as uncached audio and all outputs as audio.
      // Not a guaranteed bill; reasoning/billing details and in-flight spend can differ.
      this.metric.estimatedCents =
        (this.metric.inputTokens * 32 + this.metric.outputTokens * 64) / 10000;
      if (this.metric.estimatedCents >= this.approval.budgetCents)
        return this.stop('ended');
      const queued = this.queuedResponse;
      this.queuedResponse = null;
      if (queued) this.requestResponse(queued.instructions, queued.speakOnly);
    } else if (event.type === 'output_audio_buffer.started') {
      const audio = z.object({ response_id: z.string().max(200) }).parse(raw);
      if (this.audioStarted.has(audio.response_id)) return;
      this.audioStarted.set(audio.response_id, this.now());
      this.metric.firstAudioMs ??= Math.max(0, this.now() - this.startedAt);
      this.metric.responseLatencyMs.push(
        Math.max(0, this.now() - this.lastRequestAt),
      );
    }
    await this.save();
  }
  async acknowledge(turnId: string, responseId: string, epoch: number) {
    const pending = this.pending;
    const prior = this.completed.get(turnId);
    if (prior && prior.responseId === responseId && prior.epoch === epoch)
      return this.snapshot();
    if (
      this.status !== 'active' ||
      !pending ||
      pending.turnId !== turnId ||
      pending.responseId !== responseId ||
      pending.epoch !== epoch ||
      epoch !== this.epoch ||
      this.now() >= this.stopAt
    ) {
      this.metric.staleRejected++;
      await this.save();
      throw new Error('Stale playback acknowledgment.');
    }
    const now = this.now();
    const command = mayaCommandSchema.parse({
      protocolVersion: 1,
      commandId: turnId,
      lessonId: this.id,
      sequence: this.events.length + 1,
      actor: 'maya',
      epoch,
      synchronization: {
        speechId: turnId,
        anchor: 'speech_start',
        offsetMs: 0,
      },
      action: stepAction(pending.step.step),
    });
    this.event('board_applied', { command, responseId });
    this.acceptedSteps.add(pending.step.step);
    this.completed.set(turnId, { responseId, epoch });
    this.metric.boardLatencyMs.push(Math.max(0, now - pending.proposedAt));
    const audioStartedAt = this.audioStarted.get(responseId);
    if (audioStartedAt !== undefined)
      this.metric.coordinationDelayMs.push(Math.max(0, now - audioStartedAt));
    this.pending = null;
    await this.save();
    return this.snapshot();
  }
  async interrupt() {
    if (this.status !== 'active') return;
    const began = this.now();
    this.epoch++;
    this.pending = null;
    if (this.activeResponse) this.connection?.send({ type: 'response.cancel' });
    this.connection?.send({ type: 'output_audio_buffer.clear' });
    this.queuedResponse = null;
    this.event('interrupted');
    this.metric.interruptionMs.push(Math.max(0, this.now() - began));
    if (this.metric.interruptionMs.length > 20)
      this.metric.interruptionMs.shift();
    await this.save();
  }
  heartbeat() {
    this.lastHeartbeat = this.now();
  }
  async tick() {
    if (this.status !== 'active') return;
    if (
      this.now() >= this.stopAt ||
      this.now() - this.lastHeartbeat > 15000 ||
      this.events.length >= 180 ||
      ((this.activeResponse || this.awaitingResponse) &&
        this.now() - this.lastRequestAt > 15000) ||
      (this.pending && this.now() - this.pending.proposedAt > 15000)
    )
      await this.stop('ended');
  }
  stop(reason: 'ended' | 'provider_failure') {
    if (this.stopping) return this.stopping;
    this.status = reason === 'provider_failure' ? 'abandoned' : 'ended';
    this.epoch++;
    this.pending = null;
    this.stopAt = Math.min(this.stopAt, this.now());
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.connection?.close();
    this.connection = null;
    this.event(reason);
    if (reason === 'provider_failure') this.metric.failures++;
    this.stopping = (async () => {
      try {
        if (this.callId) await this.transport.hangup(this.callId);
        else if (this.attempted)
          throw new Error('Unknown provider call requires operational review.');
        this.metric.terminationConfirmed = true;
        await this.save();
        await this.store.release();
      } catch {
        this.metric.terminationConfirmed = false;
        await this.save(); /* Retain concurrency lock; fail closed after uncertain termination. */
      }
    })();
    return this.stopping;
  }
}
