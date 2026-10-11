import { expect, it, vi, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
vi.mock('server-only', () => ({}));
import {
  lessonContextSchema,
  teachingPlanSchema,
  toolInputSchema,
  mockOperationSchema,
  teachingPolicy,
} from '@/features/maya/contracts';
import { buildMockPlan, validatePlan } from '@/features/maya/planner';
import { mockEventSchema, teachingView } from '@/features/maya/events';
import { SessionBudget } from '@/features/maya/budget';
import { InactiveWebRTCVoice } from '@/features/maya/voice';
import {
  readProviderConfig,
  assertLiveAuthorization,
  InactiveOpenAITeachingProvider,
  MockTeachingProvider,
  realtimeConfiguration,
} from '@/server/maya/provider';
import type { ClassroomEvent } from '@/features/classroom/protocol';
import templates from '@/features/maya/mock-lessons.json';
import frozenEvents from '@/features/maya/mock-event.schema.json';
const student = randomUUID(),
  lesson = randomUUID(),
  skill = randomUUID(),
  publication = randomUUID();
export function contextFixture() {
  return lessonContextSchema.parse({
    schemaVersion: 1,
    mode: 'supervised_mock',
    studentReference: student,
    lessonReference: lesson,
    scheduleReference: randomUUID(),
    publicationReference: publication,
    publicationVersion: 1,
    course: 'Grade 8 Mathematics',
    unit: 'Algebra',
    topic: 'Linear Equations',
    chapterGuidance: {
      keyConcepts: [],
      explanations: [],
      workedExamples: [],
      commonMistakes: [],
    },
    prerequisiteSkills: [],
    objectives: ['Add signed integers.'],
    skills: [
      {
        id: skill,
        code: 'integers',
        name: 'Integer arithmetic',
        prerequisites: [],
        learningState: 'unassessed',
        evidenceReferences: [],
      },
    ],
    misconceptions: 'not_loaded_unverified',
    previousGenuineSummary: null,
    homework: { recordedAssignments: 0, partial: false },
    policyVersion: 'maya-mock-1',
    constraints: {
      maxDurationSeconds: 300,
      externalRequests: false,
      mediaCapture: false,
      learningWrites: false,
    },
  });
}
const event = (
  kind: string,
  payload: Record<string, unknown>,
  sequence: number,
  epoch = 0,
): ClassroomEvent => ({
  id: randomUUID(),
  lessonId: lesson,
  sequence,
  epoch,
  protocolVersion: 1,
  source: 'maya_mock',
  kind,
  payload,
  createdAt: new Date().toISOString(),
});
it('validates a compact unknown context without fabricated history or private answers', () => {
  const c = contextFixture();
  expect(c.skills[0].learningState).toBe('unassessed');
  expect(c.previousGenuineSummary).toBeNull();
  expect(() =>
    lessonContextSchema.parse({ ...c, answerKey: 'secret' }),
  ).toThrow();
});
it('produces deterministic scoped plans with simulation provenance and non-binding homework intent', async () => {
  const c = contextFixture(),
    p = buildMockPlan(c);
  expect(buildMockPlan(c)).toEqual(p);
  expect(p.newSkills).toEqual([skill]);
  expect(p.homeworkIntent).toBeNull();
  expect(p.provenance.publicationReference).toBe(publication);
  expect(await new MockTeachingProvider().plan(c)).toEqual(p);
});
it('refuses unsupported planned skills instead of silently teaching an unrelated skill', () => {
  const c = contextFixture();
  c.skills[0].code = 'fractions';
  expect(() => buildMockPlan(c)).toThrow('No reviewed simulation');
});
it.each(['publication', 'target', 'review', 'objective', 'timing'])(
  'rejects invalid planner %s proposals',
  (variant) => {
    const c = contextFixture(),
      p = buildMockPlan(c);
    if (variant === 'publication')
      p.provenance.publicationReference = randomUUID();
    if (variant === 'target') p.newSkills = [randomUUID()];
    if (variant === 'review') p.reviewSkills = [randomUUID()];
    if (variant === 'objective') p.objective = 'Unrelated';
    if (variant === 'timing') p.steps[0].offsetMs = 5000;
    expect(() => validatePlan(p, c)).toThrow();
  },
);
it('rejects unbounded and unsafe structured plan extensions', () => {
  const p = buildMockPlan(contextFixture());
  expect(() => teachingPlanSchema.parse({ ...p, mastery: 1 })).toThrow();
  expect(() =>
    teachingPlanSchema.parse({ ...p, steps: Array(11).fill(p.steps[0]) }),
  ).toThrow();
});
it('freezes canonical mock schema/templates with database validation', () => {
  expect(z.toJSONSchema(mockEventSchema)).toEqual(frozenEvents);
  const migration = readFileSync(
    'supabase/migrations/202610110008_maya_mock.sql',
    'utf8',
  );
  expect(JSON.parse(migration.split('$mock_templates$')[1])).toEqual(templates);
  expect(JSON.parse(migration.split('$mock_events$')[1])).toEqual(frozenEvents);
});
it('keeps mandatory authorization separate from pedagogy and simulation activation', () => {
  expect(teachingPolicy.activation).toBe('simulation_only');
  expect(teachingPolicy.mandatory).toContain('No child pilot');
  expect(Object.isFrozen(teachingPolicy)).toBe(true);
});
it.each([
  'update_mastery',
  'assign_homework',
  'modify_schedule',
  'edit_consent',
  'change_publication',
])('refuses forbidden tool %s', (name) => {
  expect(toolInputSchema.safeParse({ name, arguments: {} }).success).toBe(
    false,
  );
});
it('validates approved tool inputs and bounded board coordinates without executing strings', () => {
  expect(
    toolInputSchema.safeParse({ name: 'get_lesson_context', arguments: {} })
      .success,
  ).toBe(true);
  expect(
    toolInputSchema.safeParse({
      name: 'write_whiteboard_math',
      arguments: { text: 'x = 4', at: { x: 0.2, y: 0.3 } },
    }).success,
  ).toBe(true);
  expect(
    toolInputSchema.safeParse({
      name: 'write_whiteboard_math',
      arguments: { text: 'x'.repeat(501), at: { x: 2, y: 0 } },
    }).success,
  ).toBe(false);
});
it('rejects role/source/provider injection in mock controls', () => {
  expect(
    mockOperationSchema.safeParse({
      commandId: randomUUID(),
      expectedEpoch: 0,
      action: 'start',
      speechId: null,
      provider: 'openai',
    }).success,
  ).toBe(false);
});
it('coordinates committed board commands with narration references and preserves them across interruption', () => {
  const speechId = randomUUID(),
    commandId = randomUUID();
  const events = [
    event(
      'maya_session_started',
      {
        provider: 'mock',
        policyVersion: 'maya-mock-1',
        plannerVersion: 'mock-planner-1',
      },
      1,
    ),
    event(
      'maya_explanation_started',
      {
        step: 0,
        speechId,
        narration: 'Add integers.',
        durationMs: 4000,
        offsetMs: 1200,
        generation: 0,
        boardAlreadyApplied: false,
      },
      2,
    ),
    event(
      'maya_whiteboard_applied',
      {
        step: 0,
        speechId,
        command: {
          protocolVersion: 1,
          commandId,
          lessonId: lesson,
          sequence: 3,
          actor: 'maya',
          epoch: 0,
          synchronization: {
            speechId,
            anchor: 'playback_offset',
            offsetMs: 1200,
          },
          action: templates.integers[0].board,
        },
      },
      3,
    ),
  ];
  expect(teachingView(events, 0).explanation?.applied).toBe(true);
  events.push(event('maya_interrupted', { speechId }, 4, 1));
  const next = teachingView(events, 1);
  expect(next.explanation).toBeNull();
  expect(next.scene.size).toBe(1);
  expect(teachingView([...events, events[2]], 1).scene.size).toBe(1);
});
it('discards stale pending generations while restoring committed visuals on refresh', () => {
  const speechId = randomUUID();
  const events = [
    event(
      'maya_explanation_started',
      {
        step: 0,
        speechId,
        narration: 'Add integers.',
        durationMs: 4000,
        offsetMs: 1200,
        generation: 0,
        boardAlreadyApplied: false,
      },
      1,
    ),
  ];
  expect(teachingView(events, 1).explanation).toBeNull();
  expect(teachingView(events, 0).scene.size).toBe(0);
});
it('validates envelopes and ordering during replay', () => {
  const speechId = randomUUID(),
    bad = event(
      'maya_whiteboard_applied',
      {
        step: 0,
        speechId,
        command: {
          protocolVersion: 1,
          commandId: randomUUID(),
          lessonId: randomUUID(),
          sequence: 1,
          actor: 'maya',
          epoch: 0,
          action: templates.integers[0].board,
        },
      },
      1,
    );
  expect(() => teachingView([bad], 0)).toThrow('envelope');
  expect(() => teachingView([{ ...bad, sequence: 2 }], 0)).toThrow(
    'Replay gap',
  );
});
it('is mock by default and rejects malformed/obsolete provider configuration', () => {
  expect(readProviderConfig({})).toMatchObject({
    mode: 'mock',
    maxConcurrentSessions: 1,
    maxReconnects: 0,
  });
  expect(() => readProviderConfig({ MAYA_PROVIDER: 'live' })).toThrow();
  expect(() =>
    readProviderConfig({ MAYA_REALTIME_MODEL: 'gpt-4o-realtime-preview' }),
  ).toThrow();
  expect(() => readProviderConfig({ MAYA_BUDGET_CENTS: 'NaN' })).toThrow();
});
it('denies live activation for production, missing keys, and parent/admin/flag opt-ins', () => {
  const config = readProviderConfig({ MAYA_PROVIDER: 'development_ai' });
  expect(() =>
    assertLiveAuthorization(config, {
      NODE_ENV: 'production',
      OPENAI_API_KEY: 'synthetic',
    }),
  ).toThrow('disabled');
  expect(() =>
    assertLiveAuthorization(config, { NODE_ENV: 'development' }),
  ).toThrow('missing');
  expect(() =>
    assertLiveAuthorization(config, {
      NODE_ENV: 'development',
      OPENAI_API_KEY: 'synthetic',
      MAYA_LIVE_APPROVED: 'true',
    }),
  ).toThrow('trusted developer');
});
it('inactive OpenAI adapter never makes an external planning or credential call', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const provider = new InactiveOpenAITeachingProvider();
  await expect(provider.plan(contextFixture())).rejects.toThrow('disabled');
  await expect(provider.issueRealtimeCredential()).rejects.toThrow('disabled');
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});
it('builds the documented non-preview realtime configuration with bounded output and no unrestricted tools', () => {
  const config = realtimeConfiguration(readProviderConfig({}), 'test');
  expect(config).toMatchObject({
    type: 'realtime',
    model: 'gpt-realtime-2.1',
    max_output_tokens: 256,
    tools: [],
    audio: { input: { turn_detection: { create_response: false } } },
  });
});
it.each(['unverified', 'unknown', 'overspend', 'expired', 'stopped'])(
  'budget fails closed on %s',
  (reason) => {
    const b = new SessionBudget(1000, 1000, 25, reason !== 'unverified');
    if (reason === 'stopped') b.stop();
    expect(() =>
      b.authorize(
        reason === 'expired' ? 2000 : 1001,
        reason === 'unknown' ? null : reason === 'overspend' ? 26 : 1,
      ),
    ).toThrow();
    expect(b.telemetry.stopped).toBe(true);
  },
);
it('tracks estimates separately from actual usage and rejects malformed telemetry', () => {
  const b = new SessionBudget(1000, 1000, 25, true);
  b.authorize(1100, 3);
  expect(b.telemetry.reservedEstimatedCents).toBe(3);
  expect(
    b.recordUsage({ inputTokens: 3, outputTokens: 2, estimatedCents: 0.1 }),
  ).toEqual({ inputTokens: 3, outputTokens: 2, estimatedCents: 0.1 });
  expect(() => b.recordUsage({ inputTokens: -1 })).toThrow();
});
it('requires explicit opt-in and unexpired bounded grants before any capture', async () => {
  const audio = {
    pause: vi.fn(),
    srcObject: null,
  } as unknown as HTMLAudioElement;
  const voice = new InactiveWebRTCVoice(audio, vi.fn(), vi.fn());
  const grant = {
    value: 'synthetic',
    expiresAt: Date.now() + 10000,
    stopAt: Date.now() + 30000,
    fixture: 'approved_synthetic_adult' as const,
    model: 'gpt-realtime-2.1' as const,
  };
  await expect(voice.connect(grant, false)).rejects.toThrow('permission');
  await expect(
    voice.connect({ ...grant, expiresAt: Date.now() - 1 }, true),
  ).rejects.toThrow('grant');
  await expect(
    voice.connect({ ...grant, stopAt: Date.now() + 400000 }, true),
  ).rejects.toThrow('grant');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('handles permission failure without retaining tracks or attempting a provider request', async () => {
  const getUserMedia = vi.fn().mockRejectedValue(new Error('denied'));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const fetch = vi.spyOn(globalThis, 'fetch');
  const audio = {
      pause: vi.fn(),
      srcObject: null,
    } as unknown as HTMLAudioElement,
    state = vi.fn();
  const voice = new InactiveWebRTCVoice(audio, state, vi.fn());
  await expect(
    voice.connect(
      {
        value: 'synthetic',
        expiresAt: Date.now() + 5000,
        stopAt: Date.now() + 30000,
        fixture: 'approved_synthetic_adult',
        model: 'gpt-realtime-2.1',
      },
      true,
    ),
  ).rejects.toThrow('failed');
  expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  expect(fetch).not.toHaveBeenCalled();
  expect(state).toHaveBeenLastCalledWith('interrupted');
  fetch.mockRestore();
});
it('times out pending capture and stops tracks if permission resolves after cancellation', async () => {
  vi.useFakeTimers();
  let resolve!: (s: MediaStream) => void;
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(
        () =>
          new Promise<MediaStream>((r) => {
            resolve = r;
          }),
      ),
    },
  });
  const stop = vi.fn(),
    voice = new InactiveWebRTCVoice(
      { pause: vi.fn(), srcObject: null } as unknown as HTMLAudioElement,
      vi.fn(),
      vi.fn(),
    );
  const connected = voice.connect(
    {
      value: 'synthetic',
      expiresAt: Date.now() + 20000,
      stopAt: Date.now() + 30000,
      fixture: 'approved_synthetic_adult',
      model: 'gpt-realtime-2.1',
    },
    true,
  );
  await vi.advanceTimersByTimeAsync(10000);
  resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await connected;
  expect(stop).toHaveBeenCalledOnce();
});
it('a successful fake voice connection interrupts and releases tracks without real requests or retained audio', async () => {
  const stop = vi.fn(),
    send = vi.fn(),
    closeChannel = vi.fn(),
    closePeer = vi.fn(),
    state = vi.fn(),
    proposal = vi.fn();
  const channel = {
    readyState: 'open',
    send,
    close: closeChannel,
    onmessage: null as ((event: { data: string }) => void) | null,
  };
  const peer = {
    addTrack: vi.fn(),
    createDataChannel: () => channel,
    createOffer: async () => ({ sdp: 'fake-offer' }),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    close: closePeer,
    ontrack: null,
    onconnectionstatechange: null,
    connectionState: 'connected',
  };
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop }],
        getAudioTracks: () => [{ stop }],
      }),
    },
  });
  vi.stubGlobal(
    'RTCPeerConnection',
    class {
      constructor() {
        return peer;
      }
    },
  );
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('fake-answer'));
  const audio = {
    pause: vi.fn(),
    play: vi.fn(),
    srcObject: null,
  } as unknown as HTMLAudioElement;
  const voice = new InactiveWebRTCVoice(audio, state, proposal);
  await voice.connect(
    {
      value: 'synthetic',
      expiresAt: Date.now() + 5000,
      stopAt: Date.now() + 30000,
      fixture: 'approved_synthetic_adult',
      model: 'gpt-realtime-2.1',
    },
    true,
  );
  expect(state).toHaveBeenLastCalledWith('listening');
  channel.onmessage!({
    data: JSON.stringify({
      type: 'response.function_call_arguments.done',
      name: 'get_current_objective',
      arguments: '{}',
    }),
  });
  expect(proposal).toHaveBeenCalledWith({
    name: 'get_current_objective',
    arguments: {},
  });
  voice.interrupt();
  expect(send).toHaveBeenCalledWith(
    JSON.stringify({ type: 'response.cancel' }),
  );
  expect(send).toHaveBeenCalledWith(
    JSON.stringify({ type: 'output_audio_buffer.clear' }),
  );
  voice.stop();
  expect(stop).toHaveBeenCalledOnce();
  expect(closePeer).toHaveBeenCalledOnce();
  expect(closeChannel).toHaveBeenCalledOnce();
  expect(audio.srcObject).toBeNull();
  fetch.mockRestore();
});
