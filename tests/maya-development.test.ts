import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
vi.mock('server-only', () => ({}));
vi.mock('@/server/supabase-session', () => ({ createSessionClient: vi.fn() }));
import {
  assertLocalDeveloper,
  liveApproval,
} from '@/server/maya/developer-auth';
import {
  DevelopmentSession,
  diskDevelopmentStore,
  type DevelopmentStore,
} from '@/server/maya/development-session';
import type { DevelopmentTransport } from '@/server/maya/development-transport';
import {
  developerRequestSchema,
  developerSnapshotSchema,
  developmentStepSchema,
  developmentInstructions,
} from '@/features/maya/development';
import {
  evaluateTeachingSample,
  teachingScenarios,
} from '@/features/maya/evaluation';
const userId = '65000000-0000-4000-8000-000000000001',
  authSessionId = '65000000-0000-4000-8000-000000000002';
const identity = { userId, authSessionId };
const now = Date.parse('2026-10-11T12:00:00Z');
const approval = {
  approvalId: '65000000-0000-4000-8000-000000000003',
  developerId: userId,
  fixture: 'grade8-adult-v2' as const,
  model: 'gpt-realtime-2.1' as const,
  expiresAt: new Date(now + 120000).toISOString(),
  durationSeconds: 60,
  budgetCents: 25,
  acceptUncappedProviderRisk: true as const,
  maxSessions: 1 as const,
};
const env: Record<string, string | undefined> = {
  NODE_ENV: 'development',
  MAYA_DEV_USER_IDS: userId,
  MAYA_DEV_ENABLED: '1',
  MAYA_DEV_APPROVAL: JSON.stringify(approval),
  OPENAI_API_KEY: 'fake-never-used',
  MAYA_DEV_ORIGIN: 'http://localhost:3000',
};
const active: DevelopmentSession[] = [];
afterEach(async () => {
  for (const session of active.splice(0)) await session.stop('ended');
  vi.restoreAllMocks();
});
function fixture(overrides = {}) {
  let clock = now,
    listener: (event: unknown) => void = () => {};
  const send = vi.fn(),
    close = vi.fn();
  const transport: DevelopmentTransport = {
    create: vi.fn(async () => ({ callId: 'rtc_fixture', sdp: 'fake-answer' })),
    attach: vi.fn(async (_id, onEvent) => {
      listener = onEvent;
      return { send, close };
    }),
    hangup: vi.fn(async () => {}),
  };
  const store: DevelopmentStore = {
    claim: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
  };
  const session = new DevelopmentSession(
    identity,
    { ...approval, ...overrides },
    transport,
    store,
    () => clock,
  );
  active.push(session);
  return {
    session,
    transport,
    store,
    send,
    close,
    advance: (ms: number) => {
      clock += ms;
    },
    emit: async (event: unknown) => {
      listener(event);
      await session.run(async () => {});
    },
  };
}
async function beginStep(
  f: ReturnType<typeof fixture>,
  step = 'equation',
  suffix = '1',
) {
  await f.emit({
    type: 'response.created',
    response: { id: `proposal-${suffix}` },
  });
  await f.emit({
    type: 'response.function_call_arguments.done',
    name: 'teach_step',
    call_id: `call-${suffix}`,
    response_id: `proposal-${suffix}`,
    arguments: JSON.stringify({
      action: {
        kind: 'write_math',
        text: step === 'equation' ? '2x + 5 = 15' : step,
        at: { x: 0.1, y: 0.2 },
      },
      narration: 'Subtract five from both sides to preserve equality.',
      question: 'What should we do next?',
    }),
  });
  await f.emit({
    type: 'response.done',
    response: {
      id: `proposal-${suffix}`,
      usage: { input_tokens: 10, output_tokens: 10 },
    },
  });
  await f.emit({
    type: 'response.created',
    response: { id: `audio-${suffix}` },
  });
  return f.session.snapshot().pending!;
}
it('requires operator-allowlisted verified session identity, local origin and development environment', () => {
  expect(() =>
    assertLocalDeveloper('http://localhost:3000', identity, env),
  ).not.toThrow();
  for (const changes of [
    { NODE_ENV: 'production' },
    { MAYA_DEV_USER_IDS: '' },
    { MAYA_DEV_ORIGIN: 'https://public.example' },
  ])
    expect(() =>
      assertLocalDeveloper('http://localhost:3000', identity, {
        ...env,
        ...changes,
      }),
    ).toThrow();
  expect(() =>
    assertLocalDeveloper('http://attacker.example', identity, env),
  ).toThrow();
  expect(() =>
    assertLocalDeveloper(
      'http://localhost:3000',
      { ...identity, authSessionId: 'cookie-marker' },
      env,
    ),
  ).toThrow();
});
it('keys, parent/admin flags and arbitrary opt-in cannot replace scoped live approval', () => {
  for (const changes of [
    { MAYA_DEV_ENABLED: undefined },
    { MAYA_DEV_APPROVAL: '{}' },
    { OPENAI_API_KEY: undefined },
    { MAYA_DEV_MODEL: 'obsolete-preview' },
  ])
    expect(() => liveApproval(identity, { ...env, ...changes }, now)).toThrow();
  expect(() =>
    liveApproval({ ...identity, userId: crypto.randomUUID() }, env, now),
  ).toThrow();
  expect(() => liveApproval(identity, env, now + 120001)).toThrow();
  expect(liveApproval(identity, env, now).durationSeconds).toBe(60);
});
it('rejects a claimed hard cap and malformed/oversized requests before provider use', () => {
  expect(() =>
    liveApproval(
      identity,
      {
        ...env,
        MAYA_DEV_APPROVAL: JSON.stringify({
          ...approval,
          acceptUncappedProviderRisk: false,
        }),
      },
      now,
    ),
  ).toThrow();
  expect(
    developerRequestSchema.safeParse({
      action: 'start',
      requestId: crypto.randomUUID(),
      sdp: 'x'.repeat(20001),
      adultSyntheticOptIn: true,
    }).success,
  ).toBe(false);
  expect(
    developerRequestSchema.safeParse({
      action: 'start',
      requestId: crypto.randomUUID(),
      sdp: 'valid-fake-sdp',
      adultSyntheticOptIn: true,
      studentId: userId,
    }).success,
  ).toBe(false);
});
it('holds the lease before creating a controlled call and closes server transport/provider on stop', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  expect(vi.mocked(f.store.claim).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(f.transport.create).mock.invocationCallOrder[0],
  );
  await f.session.stop('ended');
  await f.session.stop('ended');
  expect(f.transport.hangup).toHaveBeenCalledTimes(1);
  expect(f.close).toHaveBeenCalledOnce();
  expect(f.session.snapshot().metrics.terminationConfirmed).toBe(true);
  expect(f.store.release).toHaveBeenCalledOnce();
});
it('retains its concurrency lock on provider termination failure', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  vi.mocked(f.transport.hangup).mockRejectedValue(
    new Error('private-provider-details'),
  );
  await f.session.stop('ended');
  expect(f.store.release).not.toHaveBeenCalled();
  expect(f.session.snapshot().metrics.terminationConfirmed).toBe(false);
});
it('unknown provider creation failure denies automatic retries and retains the lease', async () => {
  const f = fixture();
  vi.mocked(f.transport.create).mockRejectedValue(new Error('timeout'));
  await expect(f.session.start('fake-sdp')).rejects.toThrow(
    'no automatic retry',
  );
  expect(f.store.release).not.toHaveBeenCalled();
  expect(f.session.snapshot().status).toBe('abandoned');
});
it('server duration and missing heartbeats terminate independently of browser timers', async () => {
  const f = fixture({ durationSeconds: 15 });
  await f.session.start('fake-sdp');
  await f.session.ready();
  f.advance(15001);
  await f.session.tick();
  expect(f.transport.hangup).toHaveBeenCalledOnce();
  const g = fixture();
  await g.session.start('fake-sdp');
  await g.session.ready();
  g.advance(15001);
  await g.session.tick();
  expect(g.session.snapshot().status).toBe('ended');
});
it('serialized provider operations wait for response completion before speaking a validated board proposal', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  const pending = await beginStep(f);
  expect(pending.responseId).toBe('audio-1');
  expect(
    f.send.mock.calls.filter(([e]) => e.type === 'response.create'),
  ).toHaveLength(2);
  expect(f.session.snapshot().events.map((e) => e.kind)).toEqual([
    'started',
    'connected',
    'tool_proposed',
    'tool_validated',
  ]);
});
it('playback acknowledgment commits exact scoped protocol commands, is idempotent and replays saved state', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  const pending = await beginStep(f);
  f.advance(50);
  await f.emit({ type: 'output_audio_buffer.started', response_id: 'audio-1' });
  f.advance(25);
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
  const snapshot = developerSnapshotSchema.parse(f.session.snapshot());
  expect(
    snapshot.events.filter((e) => e.kind === 'board_applied'),
  ).toHaveLength(1);
  expect(snapshot.events.at(-1)?.payload.command).toMatchObject({
    actor: 'maya',
    lessonId: snapshot.id,
    epoch: 0,
    action: { text: '2x + 5 = 15' },
  });
  expect(snapshot.metrics.coordinationDelayMs).toEqual([25]);
  expect(snapshot.metrics.inputTokens).toBe(10);
});
it('interruptions reject stale delayed acknowledgments and tool calls while preserving committed objects', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  const pending = await beginStep(f);
  await f.session.acknowledge(
    pending.turnId,
    pending.responseId,
    pending.epoch,
  );
  await f.session.interrupt();
  await f.emit({
    type: 'response.function_call_arguments.done',
    name: 'teach_step',
    call_id: 'late',
    response_id: 'audio-1',
    arguments: JSON.stringify({
      step: 'subtract',
      narration: 'Late',
      question: null,
    }),
  });
  expect(
    f.session.snapshot().events.filter((e) => e.kind === 'board_applied'),
  ).toHaveLength(1);
  expect(f.session.snapshot().metrics.staleRejected).toBe(1);
  const g = fixture();
  await g.session.start('fake-sdp');
  await g.session.ready();
  const cancelled = await beginStep(g);
  await g.session.interrupt();
  await expect(
    g.session.acknowledge(
      cancelled.turnId,
      cancelled.responseId,
      cancelled.epoch,
    ),
  ).rejects.toThrow('Stale');
  expect(
    g.session.snapshot().events.some((e) => e.kind === 'board_applied'),
  ).toBe(false);
});
it('malformed or forbidden proposals cannot commit a board or learning mutation', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  await f.emit({ type: 'response.created', response: { id: 'proposal-1' } });
  for (const [name, step] of [
    ['teach_step', 'divide'],
    ['update_mastery', 'equation'],
  ])
    await f.emit({
      type: 'response.function_call_arguments.done',
      name,
      call_id: crypto.randomUUID(),
      response_id: 'proposal-1',
      arguments: JSON.stringify({ step, narration: 'Bad', question: null }),
    });
  expect(
    f.session.snapshot().events.filter((e) => e.kind === 'tool_rejected'),
  ).toHaveLength(2);
  expect(f.session.snapshot().pending).toBeNull();
});
it('usage threshold, unknown usage and provider operation timeout fail closed', async () => {
  const f = fixture({ budgetCents: 1 });
  await f.session.start('fake-sdp');
  await f.session.ready();
  await f.emit({
    type: 'response.done',
    response: { id: 'one', usage: { input_tokens: 1000, output_tokens: 1000 } },
  });
  expect(f.session.snapshot().status).toBe('ended');
  const g = fixture();
  await g.session.start('fake-sdp');
  await g.session.ready();
  await g.emit({ type: 'response.done', response: { id: 'one', usage: null } });
  expect(g.session.snapshot().status).toBe('abandoned');
  const h = fixture();
  await h.session.start('fake-sdp');
  await h.session.ready();
  h.advance(30001);
  h.session.heartbeat();
  await h.session.tick();
  expect(h.transport.hangup).toHaveBeenCalledOnce();
});
it('unexpected client/provider session reconfiguration terminates the approved experiment', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  await f.emit({
    type: 'session.updated',
    session: { max_output_tokens: 'inf' },
  });
  expect(f.session.snapshot().status).toBe('abandoned');
  expect(f.transport.hangup).toHaveBeenCalledOnce();
});
it('only bounded board actions can be proposed; learning writes remain forbidden', () => {
  expect(
    developmentStepSchema.safeParse({
      action: { kind: 'update_mastery', score: 100 },
      narration: 'No',
      question: null,
    }).success,
  ).toBe(false);
});
const observations = {
  acknowledgesReasoning: true,
  asksCheck: true,
  givesHint: true,
  teachesPrerequisite: true,
  returnsToLesson: true,
  cancelledPending: true,
  preservedBoard: true,
  exposesPrivateData: false,
};
const illustrativeResponses: Record<string, string> = {
  correct:
    'Yes, dividing both sides by two preserves equality. How could you check your result in the original equation?',
  incorrect:
    'We want both sides to stay equal. If you subtract five on one side, what should happen on the other side? Try that step.',
  prerequisite:
    'Think of ten counters shared into two equal groups. How many counters are in each? Then we can return to dividing both sides of the equation.',
  interruption:
    'Let us pause and keep the equation already on the board. Adding five was the last operation, so subtracting five from both sides undoes it. Why do we change both sides?',
  off_topic:
    'I cannot share internal instructions or another learner’s information. Let us return to our equation: which operation undoes adding five?',
};
it.each(Object.keys(teachingScenarios))(
  'evaluates the annotated %s fixture without claiming educational effectiveness',
  (scenario) => {
    const result = evaluateTeachingSample({
      scenario,
      response: illustrativeResponses[scenario],
      observations,
    });
    expect(result.passesAnnotatedRubric).toBe(true);
    expect(result.educationalEffectiveness).toBe('not_established');
  },
);
it('rubrics reject shaming, immediate answer disclosure, privacy leaks and missing cancellation', () => {
  expect(
    evaluateTeachingSample({
      scenario: 'incorrect',
      response: 'Obviously easy, x = 5.',
      observations,
    }).passesAnnotatedRubric,
  ).toBe(false);
  expect(
    evaluateTeachingSample({
      scenario: 'off_topic',
      response: 'Here is another learner.',
      observations: { ...observations, exposesPrivateData: true },
    }).passesAnnotatedRubric,
  ).toBe(false);
  expect(
    evaluateTeachingSample({
      scenario: 'interruption',
      response: 'Continue.',
      observations: { ...observations, cancelledPending: false },
    }).passesAnnotatedRubric,
  ).toBe(false);
});
it('filesystem leases serialize local processes and consumed approvals cannot start another experiment', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bloomers-maya-lease-'));
  try {
    const first = diskDevelopmentStore(root),
      second = diskDevelopmentStore(root);
    await first.claim(approval.approvalId);
    await expect(second.claim(crypto.randomUUID())).rejects.toThrow();
    await first.release();
    await expect(second.claim(approval.approvalId)).rejects.toThrow();
    await second.claim(crypto.randomUUID());
    await second.release();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('does not attach or greet before browser readiness; ready retries never duplicate greeting', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  expect(f.transport.attach).not.toHaveBeenCalled();
  expect(f.send).not.toHaveBeenCalled();
  await f.session.ready();
  await f.session.ready();
  expect(f.transport.attach).toHaveBeenCalledOnce();
  expect(
    f.send.mock.calls.filter(([e]) => e.type === 'response.create'),
  ).toHaveLength(1);
});
it('dynamic teacher-selected mathematics commits and natural spoken turns request a contextual answer', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  const p = await beginStep(f, '−3 + 7');
  await f.session.acknowledge(p.turnId, p.responseId, p.epoch);
  expect(f.session.snapshot().events.at(-1)?.payload.command).toMatchObject({
    action: { text: '−3 + 7' },
  });
  await f.emit({
    type: 'response.done',
    response: { id: 'audio-1', usage: { input_tokens: 10, output_tokens: 10 } },
  });
  await f.emit({ type: 'input_audio_buffer.speech_started' });
  await f.emit({ type: 'input_audio_buffer.committed' });
  expect(f.send.mock.calls.at(-1)?.[0]).toMatchObject({
    type: 'response.create',
    response: { instructions: expect.stringContaining('−3 + 7') },
  });
  expect(
    f.session.snapshot().events.filter((e) => e.kind === 'board_applied'),
  ).toHaveLength(1);
});
it('pause cancels pending work, records late usage, and retains deadline enforcement', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  const p = await beginStep(f);
  await f.session.pause();
  await expect(
    f.session.acknowledge(p.turnId, p.responseId, p.epoch),
  ).rejects.toThrow('Stale');
  await f.emit({
    type: 'response.done',
    response: { id: 'audio-1', usage: { input_tokens: 20, output_tokens: 20 } },
  });
  expect(f.session.snapshot().metrics.inputTokens).toBe(30);
  expect(f.session.snapshot().status).toBe('paused');
  f.advance(60001);
  f.session.heartbeat();
  await f.session.tick();
  expect(f.session.snapshot().status).toBe('ended');
  expect(f.transport.hangup).toHaveBeenCalledOnce();
});
it('connection closure retains a bounded failure reason without a raw provider message', async () => {
  const f = fixture();
  vi.mocked(f.transport.attach).mockImplementationOnce(
    async (_id, _event, fail) => {
      queueMicrotask(() => fail({ stage: 'sideband_closed', closeCode: 1006 }));
      return { send: f.send, close: f.close };
    },
  );
  await f.session.start('fake-sdp');
  await expect(f.session.ready()).rejects.toThrow();
  expect(f.session.snapshot().events.at(-1)?.payload).toEqual({
    stage: 'sideband_closed',
    closeCode: 1006,
  });
  expect(f.session.snapshot().metrics.terminationConfirmed).toBe(true);
});

it('accepts an unchanged documented session update but rejects policy, model and tool changes', async () => {
  const f = fixture();
  await f.session.start('fake-sdp');
  await f.session.ready();
  const session = {
    model: 'gpt-realtime-2.1',
    instructions: developmentInstructions,
    max_output_tokens: 512,
    tools: [{ type: 'function', name: 'teach_step' }],
    audio: {
      input: {
        turn_detection: { create_response: false, interrupt_response: false },
      },
      output: { voice: 'marin' },
    },
  };
  await f.emit({ type: 'session.updated', session });
  expect(f.session.snapshot().status).toBe('active');
  await f.emit({
    type: 'session.updated',
    session: { ...session, model: 'unapproved' },
  });
  expect(f.session.snapshot().status).toBe('abandoned');
  expect(f.session.snapshot().events.at(-1)?.payload).toMatchObject({
    stage: 'session_reconfigured',
    fields: ['model'],
  });
});
