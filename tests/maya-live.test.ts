import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('server-only', () => ({}));
import {
  LiveDevelopmentSession,
  type LiveReasoner,
} from '@/server/maya/live-session';
import type { LiveTransport } from '@/server/maya/live-transport';
import { liveApproval } from '@/server/maya/developer-auth';
const now = Date.parse('2026-10-24T12:00:00Z');
const identity = { userId: randomUUID(), authSessionId: randomUUID() };
const approval = {
  approvalId: randomUUID(),
  developerId: identity.userId,
  model: 'gpt-live-1' as const,
  backendModel: 'gpt-5.6-terra' as const,
  fixture: 'grade8-adult-v2' as const,
  expiresAt: new Date(now + 300000).toISOString(),
  durationSeconds: 180,
  budgetCents: 100,
  acceptUncappedProviderRisk: true as const,
  maxSessions: 1 as const,
};
const proposal = {
  action: {
    kind: 'write_math' as const,
    text: '−3 + 7',
    at: { x: 0.15, y: 0.2 },
  },
  narration: 'Start at negative three and move seven to the right.',
  question: 'Where do you finish?',
};
const sessions: LiveDevelopmentSession[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  for (const s of sessions.splice(0)) await s.stop('ended');
  vi.useRealTimers();
});
async function fixture(reasoner?: LiveReasoner) {
  let event: (value: unknown) => void = () => {};
  let clock = now;
  const send = vi.fn(),
    close = vi.fn();
  const finish = vi.fn(async () =>
    event({ type: 'session.closed', usage: { seconds: 18 } }),
  );
  const transport: LiveTransport = {
    create: vi.fn(async () => ({
      sdp: 'fake-answer',
      callId: 'live_synthetic',
    })),
    attach: vi.fn(async (_id, receive) => {
      event = receive;
      return { send, close };
    }),
    finish,
  };
  const store = {
    claim: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
  };
  const explain = vi.fn<LiveReasoner['explain']>(async () => ({
    step: proposal,
    inputTokens: 100,
    outputTokens: 80,
  }));
  const session = new LiveDevelopmentSession(
    identity,
    approval,
    transport,
    store,
    reasoner ?? { explain },
    () => clock,
  );
  sessions.push(session);
  await session.start('fake-offer');
  await session.ready();
  async function emit(value: unknown) {
    event(value);
    for (let n = 0; n < 5; n++) {
      await Promise.resolve();
      await session.run(async () => {});
    }
  }
  const delegate = (id = 'item_1') =>
    emit({
      type: 'session.delegation.created',
      delegation: { id, target: 'client' },
    });
  return {
    session,
    store,
    send,
    close,
    finish,
    transport,
    emit,
    delegate,
    explain,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}
it('requires a fresh Live and backend scoped approval, rejecting Realtime and unsupported model IDs', () => {
  const env = {
    MAYA_DEV_ENABLED: '1',
    OPENAI_API_KEY: 'fake',
    MAYA_DEV_APPROVAL: JSON.stringify(approval),
  };
  expect(liveApproval(identity, env, now).model).toBe('gpt-live-1');
  for (const change of [
    { model: 'gpt-realtime-2.1' },
    { model: 'gpt-live-1.1' },
    { backendModel: undefined },
  ])
    expect(() =>
      liveApproval(
        identity,
        {
          ...env,
          MAYA_DEV_APPROVAL: JSON.stringify({ ...approval, ...change }),
        },
        now,
      ),
    ).toThrow();
});
it('greets once and delegates dynamic board teaching without Realtime response commands', async () => {
  const f = await fixture();
  await f.session.ready();
  expect(
    f.send.mock.calls.filter(([e]) => e.type === 'session.commentary.append'),
  ).toHaveLength(1);
  await f.emit({
    type: 'session.input_transcript.delta',
    delta: 'Why subtract five?',
    start_ms: 0,
    end_ms: 100,
  });
  await f.delegate();
  expect(f.explain.mock.calls[0][0]).toContain('Why subtract five?');
  expect(
    f.session.snapshot().events.some((e) => e.kind === 'tool_validated'),
  ).toBe(true);
  expect(f.send.mock.calls.some(([e]) => e.type === 'response.create')).toBe(
    false,
  );
  await f.delegate();
  expect(f.explain).toHaveBeenCalledTimes(1);
});
it('keeps injection acknowledgment separate from board commit, then validates playback and epoch', async () => {
  const f = await fixture();
  await f.delegate();
  expect(f.session.snapshot().pending).toBeNull();
  const command = f.send.mock.calls
    .filter(([e]) => e.type === 'session.commentary.append')
    .at(-1)![0];
  await f.emit({
    type: 'session.commentary.appended',
    client_event_id: command.event_id,
    end_ms: 100,
  });
  expect(f.session.snapshot().pending).toBeNull();
  await f.emit({
    type: 'session.output_transcript.delta',
    delta: 'Let us look.',
    start_ms: 101,
    end_ms: 140,
  });
  const pending = f.session.snapshot().pending!;
  expect(pending.responseId).toBe(command.event_id);
  expect(
    f.session.snapshot().events.filter((e) => e.kind === 'board_applied'),
  ).toHaveLength(0);
  await f.session.acknowledge(
    pending.turnId,
    pending.responseId,
    pending.epoch,
  );
  await f.session.acknowledge(
    pending.turnId,
    pending.responseId,
    pending.epoch,
  );
  expect(
    f.session.snapshot().events.filter((e) => e.kind === 'board_applied'),
  ).toHaveLength(1);
});
it('spoken interruption invalidates pending board work without manual progression', async () => {
  const f = await fixture();
  await f.delegate();
  const command = f.send.mock.calls
    .filter(([e]) => e.type === 'session.commentary.append')
    .at(-1)![0];
  await f.emit({
    type: 'session.commentary.appended',
    client_event_id: command.event_id,
    end_ms: 100,
  });
  await f.emit({
    type: 'session.output_transcript.delta',
    delta: 'Move right.',
    start_ms: 101,
    end_ms: 140,
  });
  const pending = f.session.snapshot().pending!;
  await f.emit({
    type: 'session.input_transcript.delta',
    delta: 'Wait explain again',
    start_ms: 150,
    end_ms: 200,
  });
  await expect(
    f.session.acknowledge(pending.turnId, pending.responseId, pending.epoch),
  ).rejects.toThrow('Stale');
  await f.delegate('item_2');
  expect(f.explain).toHaveBeenCalledTimes(2);
  expect(f.session.snapshot().status).toBe('active');
});
it('aborts delegated work on interruption and rejects a late result, preserving cost uncertainty', async () => {
  let complete!: (value: {
    step: typeof proposal;
    inputTokens: number;
    outputTokens: number;
  }) => void;
  const explain = vi.fn<LiveReasoner['explain']>(
    () =>
      new Promise<{
        step: typeof proposal;
        inputTokens: number;
        outputTokens: number;
      }>((resolve) => {
        complete = resolve;
      }),
  );
  const f = await fixture({ explain });
  await f.delegate();
  await f.emit({
    type: 'session.input_transcript.delta',
    delta: 'Actually a different example',
    start_ms: 10,
    end_ms: 30,
  });
  expect(explain.mock.calls[0][1].aborted).toBe(true);
  complete({ step: proposal, inputTokens: 100, outputTokens: 40 });
  await f.emit({ type: 'session.usage.updated', usage: { seconds: 5 } });
  expect(f.session.snapshot().pending).toBeNull();
  expect(f.session.snapshot().metrics.estimatedCents).toBeGreaterThan(20);
  expect(f.session.snapshot().metrics.staleRejected).toBe(1);
});
it('bounds and validates adult pen strokes without granting teacher tools or academic writes', async () => {
  const f = await fixture(),
    id = randomUUID();
  const stroke = {
    kind: 'stroke',
    payload: {
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.3 },
      ],
      color: '#263b36',
      width: 4,
    },
  };
  await f.session.ink(id, 0, stroke);
  await f.session.ink(id, 0, stroke);
  expect(
    f.session.snapshot().events.filter((e) => e.kind === 'student_ink'),
  ).toHaveLength(1);
  await expect(
    f.session.ink(randomUUID(), 0, {
      kind: 'clear_board',
      payload: { confirmed: true },
    }),
  ).rejects.toThrow();
  await f.session.interrupt();
  await expect(f.session.ink(randomUUID(), 0, stroke)).rejects.toThrow('stale');
});
it('prices cumulative voice seconds once and uses both server duration and budget safeguards', async () => {
  const f = await fixture();
  await f.emit({ type: 'session.usage.updated', usage: { seconds: 12 } });
  await f.emit({ type: 'session.usage.updated', usage: { seconds: 15 } });
  expect(f.session.snapshot().metrics.voiceSeconds).toBe(15);
  expect(f.session.snapshot().metrics.estimatedCents).toBe(1.25);
  f.advance(180001);
  await f.session.tick();
  expect(f.finish).toHaveBeenCalledTimes(1);
  expect(f.store.release).toHaveBeenCalledTimes(1);
});
it('pause/resume and stop are explicit, cancellation-safe and idempotent', async () => {
  const f = await fixture();
  await f.session.pause();
  expect(f.session.snapshot().status).toBe('paused');
  expect(f.send).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'session.input_audio.mute' }),
  );
  await f.session.resume();
  expect(f.session.snapshot().status).toBe('active');
  await Promise.all([f.session.stop('ended'), f.session.stop('ended')]);
  expect(f.finish).toHaveBeenCalledTimes(1);
  expect(f.session.snapshot().metrics.terminationConfirmed).toBe(true);
});
it('failed finalization keeps the safety lease and never reconnects or creates a new session', async () => {
  const f = await fixture();
  f.finish.mockRejectedValueOnce(new Error('503'));
  await f.session.stop('ended');
  expect(f.store.release).not.toHaveBeenCalled();
  expect(f.session.snapshot().metrics.terminationConfirmed).toBe(false);
  expect(f.transport.create).toHaveBeenCalledTimes(1);
});

it('retains a connected Live lesson past the old setup deadline using wall-time cost even before provider usage arrives', async () => {
  const f = await fixture();
  f.advance(30000);
  f.session.heartbeat();
  await f.session.tick();
  expect(f.session.snapshot().status).toBe('active');
  expect(f.session.snapshot().metrics.estimatedCents).toBe(2.5);
  expect(f.session.snapshot().metrics.usageComplete).toBe(false);
  expect(f.finish).not.toHaveBeenCalled();
});
