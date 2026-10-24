import 'server-only';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  atomicPrivateJson,
  withLeaseMutex,
  developmentRoot,
} from './development-files';
import {
  developerEventSchema,
  developerSnapshotSchema,
  developmentStepSchema,
  developmentInstructions,
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
  save(
    snapshot: DeveloperSnapshot,
    callId: string | null,
    owner?: { developerId: string; approvalId: string; processId: number },
  ): Promise<void>;
  release(): Promise<void>;
}
export function diskDevelopmentStore(
  root = developmentRoot(),
): DevelopmentStore {
  const dir = join(root, '.local', 'maya');
  return {
    async claim(id) {
      return withLeaseMutex(dir, async () => {
        await mkdir(dir, { recursive: true, mode: 0o700 });
        const lock = await open(join(dir, 'active.lock'), 'wx', 0o600);
        await lock.close();
        try {
          const used = await open(
            join(dir, `approval-${id}.used`),
            'wx',
            0o600,
          );
          await used.close();
        } catch (error) {
          await unlink(join(dir, 'active.lock'));
          throw error;
        }
      });
    },
    async save(snapshot, callId, owner) {
      await atomicPrivateJson(join(dir, `${snapshot.id}.json`), {
        snapshot,
        callId,
        ...(owner ? { owner } : {}),
      });
    },
    async release() {
      await withLeaseMutex(dir, () => unlink(join(dir, 'active.lock')));
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
  private board = new Map<
    string,
    z.infer<typeof mayaCommandSchema>['action']
  >();
  private connecting = false;
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
    await this.store.save(this.snapshot(), this.callId, {
      developerId: this.identity.userId,
      approvalId: this.approval.approvalId,
      processId: process.pid,
    });
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
      policyVersion: 'maya-adult-dev-2',
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
      this.event('call_created', {
        callReference: result.callId ? 'controlled' : 'unknown',
      });
      await this.save();
      if (this.status !== 'active' || this.now() >= this.stopAt) {
        await this.transport.hangup(result.callId);
        throw new Error('Setup expired.');
      }
      return { sdp: result.sdp, snapshot: this.snapshot() };
    } catch {
      await this.stop('provider_failure');
      throw new Error(
        'Controlled provider connection failed; no automatic retry. Review local termination status.',
      );
    }
  }
  async ready() {
    if (this.status !== 'active' || !this.callId)
      throw new Error('Session unavailable.');
    if (this.connection || this.connecting) return this.snapshot();
    this.connecting = true;
    try {
      this.connection = await this.transport.attach(
        this.callId,
        (event) => {
          void this.run(() => this.providerEvent(event)).catch(() =>
            this.stop('provider_failure', { stage: 'event_validation' }),
          );
        },
        (detail) => {
          void this.stop(
            'provider_failure',
            detail ?? { stage: 'sideband_failure' },
          );
        },
      );
      if (this.status !== 'active') {
        this.connection.close();
        throw new Error('Setup interrupted.');
      }
      this.event('connected');
      this.requestResponse(
        'Greet the adult naturally. Introduce integer arithmetic and propose a first board example through teach_step. Ask one question and wait.',
      );
      await this.save();
      return this.snapshot();
    } catch {
      await this.stop('provider_failure', { stage: 'sideband_setup' });
      throw new Error('Sideband setup failed.');
    } finally {
      this.connecting = false;
    }
  }
  async pause() {
    if (this.status !== 'active') return this.snapshot();
    await this.interrupt();
    this.status = 'paused';
    this.event('paused');
    await this.save();
    return this.snapshot();
  }
  async resume() {
    if (this.status !== 'paused') return this.snapshot();
    this.status = 'active';
    this.event('resumed');
    this.requestResponse(
      `Resume the discussion briefly from this actual board: ${JSON.stringify([...this.board])}. Ask whether the adult wants clarification before continuing.`,
    );
    await this.save();
    return this.snapshot();
  }
  private requestResponse(instructions: string, speakOnly = false) {
    if (this.status !== 'active') return;
    if (this.activeResponse || this.awaitingResponse) {
      this.queuedResponse = { instructions, speakOnly };
      return;
    }
    if (++this.turns > 40) {
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
        max_output_tokens: 512,
        tool_choice: speakOnly ? 'none' : 'auto',
      },
    });
  }
  private async providerEvent(raw: unknown) {
    if (['ended', 'abandoned'].includes(this.status)) return;
    if (this.events.length >= 180) return this.stop('ended');
    const event = z.object({ type: z.string().max(100) }).parse(raw);
    if (event.type === 'error')
      return this.stop('provider_failure', { stage: 'provider_error' });
    if (event.type === 'session.updated') {
      const settings = z
        .object({
          session: z.object({
            model: z.literal('gpt-realtime-2.1'),
            instructions: z.literal(developmentInstructions),
            max_output_tokens: z.number().int().min(1).max(512),
            tools: z
              .array(
                z.object({
                  name: z.literal('teach_step'),
                  type: z.literal('function'),
                }),
              )
              .length(1),
            audio: z.object({
              input: z.object({
                turn_detection: z.object({
                  create_response: z.literal(false),
                  interrupt_response: z.literal(false),
                }),
              }),
              output: z.object({ voice: z.literal('marin') }),
            }),
          }),
        })
        .safeParse(raw);
      if (!settings.success)
        return this.stop('provider_failure', {
          stage: 'session_reconfigured',
          fields: [
            ...new Set(
              settings.error.issues
                .map((issue) => issue.path[1])
                .filter((field) =>
                  [
                    'model',
                    'instructions',
                    'max_output_tokens',
                    'tools',
                    'audio',
                  ].includes(String(field)),
                ),
            ),
          ],
        });
      return;
    }
    if (event.type === 'response.created') {
      const created = z
        .object({ response: z.object({ id: z.string().max(200) }) })
        .parse(raw);
      if (!this.awaitingResponse || this.responseEpochs.size >= 40)
        return this.stop('provider_failure', { stage: 'unexpected_response' });
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
      if (
        !step ||
        this.pending ||
        this.status !== 'active' ||
        (step.action.kind === 'erase' && !this.board.has(step.action.targetId))
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
              board: [...this.board],
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
          actionKind: step.action.kind,
        });
        this.connection?.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({
              accepted: true,
              board: [...this.board],
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
    } else if (
      event.type === 'input_audio_buffer.committed' &&
      this.status === 'active'
    ) {
      this.requestResponse(
        `Respond to the adult's latest spoken turn. Current committed board steps: ${JSON.stringify([...this.board])}. Check reasoning, hint before revealing. Use teach_step if a board explanation is helpful.`,
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
      if (this.metric.responseLatencyMs.length > 20)
        this.metric.responseLatencyMs.shift();
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
      action: pending.step.action,
    });
    this.event('board_applied', { command, responseId });
    if (pending.step.action.kind === 'clear_board') this.board.clear();
    else if (pending.step.action.kind === 'erase')
      this.board.delete(pending.step.action.targetId);
    else this.board.set(turnId, pending.step.action);
    this.completed.set(turnId, { responseId, epoch });
    this.metric.boardLatencyMs.push(Math.max(0, now - pending.proposedAt));
    const audioStartedAt = this.audioStarted.get(responseId);
    if (audioStartedAt !== undefined)
      this.metric.coordinationDelayMs.push(Math.max(0, now - audioStartedAt));
    this.pending = null;
    this.metric.boardLatencyMs = this.metric.boardLatencyMs.slice(-20);
    this.metric.coordinationDelayMs =
      this.metric.coordinationDelayMs.slice(-20);
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
  async diagnostic(detail: {
    stage: string;
    peerState: string;
    channelState: string;
    microphoneStopped: boolean;
  }) {
    if (this.events.length >= 180) return this.snapshot();
    this.event('connection_diagnostic', {
      ...detail,
      source: 'browser_report_not_authorization',
    });
    await this.save();
    return this.snapshot();
  }
  async tick() {
    if (['ended', 'abandoned'].includes(this.status)) return;
    if (
      this.now() >= this.stopAt ||
      this.now() - this.lastHeartbeat > 15000 ||
      (!this.connection && this.now() - this.startedAt > 15000) ||
      this.events.length >= 180 ||
      ((this.activeResponse || this.awaitingResponse) &&
        this.now() - this.lastRequestAt > 30000) ||
      (this.pending && this.now() - this.pending.proposedAt > 15000)
    )
      await this.stop('ended');
  }
  stop(
    reason: 'ended' | 'provider_failure',
    detail: Record<string, unknown> = {},
  ) {
    if (this.stopping) return this.stopping;
    this.status = reason === 'provider_failure' ? 'abandoned' : 'ended';
    this.epoch++;
    this.pending = null;
    this.stopAt = Math.min(this.stopAt, this.now());
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const connection = this.connection;
    this.connection = null;
    this.queuedResponse = null;
    this.event(reason, detail);
    if (reason === 'provider_failure') this.metric.failures++;
    // Assign the idempotency promise before SDK callbacks can reenter cleanup.
    this.stopping = Promise.resolve().then(async () => {
      try {
        if (connection) {
          try {
            if (this.activeResponse)
              connection.send({ type: 'response.cancel' });
            connection.send({ type: 'output_audio_buffer.clear' });
          } catch {
            /* A failed cancel must not prevent hangup. */
          }
          try {
            connection.close();
          } catch {
            /* Continue provider cleanup. */
          }
        }
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
    });
    return this.stopping;
  }
}
