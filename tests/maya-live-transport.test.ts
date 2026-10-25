import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  create: vi.fn(),
  reason: vi.fn(),
  config: vi.fn(),
  sockets: [] as unknown[],
}));
vi.mock('server-only', () => ({}));
vi.mock('openai', () => ({
  default: class {
    static APIError = class extends Error {
      status = 403;
      requestID = 'req_denied';
    };
    live = { create: mock.create };
    responses = { create: mock.reason };
    constructor(config: unknown) {
      mock.config(config);
    }
  },
}));
vi.mock('openai/resources/live/sideband/ws', () => ({
  SidebandWS: class extends EventEmitter {
    socket = new EventEmitter();
    send = vi.fn((event: { type: string }) => {
      if (event.type === 'session.close')
        queueMicrotask(() =>
          this.emit('event', {
            type: 'session.closed',
            usage: { seconds: 20 },
          }),
        );
    });
    close = vi.fn();
    constructor(
      _client: unknown,
      public params: unknown,
      public options: unknown,
    ) {
      super();
      mock.sockets.push(this);
      queueMicrotask(() => this.socket.emit('open'));
    }
  },
}));
import { openAILiveTransport } from '@/server/maya/live-transport';
import OpenAI from 'openai';
beforeEach(() => {
  vi.clearAllMocks();
  mock.sockets.length = 0;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  mock.create.mockReturnValue({
    withResponse: async () => ({
      data: {
        session: { id: 'live_example' },
        transport: { type: 'webrtc', sdp: 'synthetic-answer' },
      },
      response: new Response(null, {
        status: 201,
        headers: { 'x-request-id': 'req_synthetic' },
      }),
    }),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('uses documented Live JSON/WebRTC and read-only browser events with client delegation, no recording or credentials', async () => {
  const t = openAILiveTransport();
  expect(await t.create('synthetic-offer')).toEqual({
    callId: 'live_example',
    sdp: 'synthetic-answer',
  });
  const config = mock.create.mock.calls[0][0];
  expect(config.transport).toEqual({ type: 'webrtc', sdp: 'synthetic-offer' });
  expect(config.session).toMatchObject({
    model: 'gpt-live-1',
    store: false,
    delegation: { type: 'client' },
    audio: { output: { voice: 'marin' } },
    client: { data_channel: { allowed_client_events: [] } },
  });
  expect(config.session).not.toHaveProperty('tools');
  expect(config.session).not.toHaveProperty('max_output_tokens');
  expect(mock.config.mock.calls[0][0]).toMatchObject({
    maxRetries: 0,
    timeout: 8000,
  });
});
it('preserves the opaque session ID for sideband and waits for final session.closed before cleanup', async () => {
  const t = openAILiveTransport(),
    receive = vi.fn(),
    failed = vi.fn();
  const c = await t.attach('live_example', receive, failed);
  const socket = mock.sockets[0] as EventEmitter & {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    params: unknown;
    options: unknown;
  };
  expect(socket.params).toEqual({
    session_id: 'live_example',
    graceful_close: true,
  });
  expect(socket.options).toMatchObject({ reconnect: null });
  await t.finish('live_example');
  expect(socket.send).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'session.close' }),
  );
  expect(socket.close).toHaveBeenCalledTimes(1);
  expect(receive).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'session.closed' }),
  );
  expect(failed).not.toHaveBeenCalled();
  expect(c).toBeDefined();
});
it('timeouts finalization without claiming success, retrying or opening another paid session', async () => {
  vi.useFakeTimers();
  const t = openAILiveTransport();
  await t.attach('live_example', vi.fn(), vi.fn());
  const socket = mock.sockets[0] as {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  socket.send.mockImplementation(() => {});
  const finished = t.finish('live_example');
  const assertion = expect(finished).rejects.toThrow('unconfirmed');
  await vi.advanceTimersByTimeAsync(6001);
  await assertion;
  expect(socket.close).toHaveBeenCalledTimes(1);
  expect(mock.create).not.toHaveBeenCalled();
});
it('records SDK status and request attribution without raw credentials, SDP or error body', async () => {
  mock.create.mockReturnValue({
    withResponse: async () => {
      throw new OpenAI.APIError(
        403,
        { message: 'secret-body sk-credential synthetic-sdp' },
        'secret-body',
        new Headers(),
      );
    },
  });
  await expect(openAILiveTransport().create('synthetic-sdp')).rejects.toThrow(
    'creation failed',
  );
  const log = vi
    .mocked(console.info)
    .mock.calls.map((x) => x[0])
    .join(' ');
  expect(log).toContain('req_denied');
  expect(log).toContain('403');
  expect(log).not.toMatch(/secret-body|sk-credential|synthetic-sdp/);
});

it('uses bounded standalone Responses reasoning and validates its proposal before returning it', async () => {
  const { openAILiveReasoner } = await import('@/server/maya/live-session');
  mock.reason.mockResolvedValue({
    status: 'completed',
    usage: { input_tokens: 100, output_tokens: 80 },
    output_text: JSON.stringify({
      action: {
        kind: 'write_math',
        text: '2x + 5 = 15',
        at: { x: 0.1, y: 0.2 },
      },
      narration: 'What would undo adding five?',
      question: 'What do you think?',
    }),
  });
  const result = await openAILiveReasoner().explain(
    'synthetic adult context',
    new AbortController().signal,
  );
  expect(result.step.action.kind).toBe('write_math');
  expect(mock.reason.mock.calls[0][0]).toMatchObject({
    model: 'gpt-5.6-terra',
    store: false,
    max_output_tokens: 768,
    reasoning: { effort: 'none' },
    text: { format: { strict: true, type: 'json_schema' } },
  });
  expect(mock.reason.mock.calls[0][0]).not.toHaveProperty('tools');
  mock.reason.mockResolvedValue({
    status: 'incomplete',
    usage: null,
    output_text: '{}',
  });
  await expect(
    openAILiveReasoner().explain('synthetic', new AbortController().signal),
  ).rejects.toThrow('incomplete');
});
