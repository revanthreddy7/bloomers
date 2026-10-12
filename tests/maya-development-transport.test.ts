import { EventEmitter } from 'node:events';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  create: vi.fn(),
  hangup: vi.fn(),
  options: vi.fn(),
  sockets: [] as unknown[],
}));
vi.mock('server-only', () => ({}));
vi.mock('openai', () => ({
  default: class {
    realtime = { calls: { create: mock.create, hangup: mock.hangup } };
    constructor(options: unknown) {
      mock.options(options);
    }
  },
}));
vi.mock('openai/realtime/ws', () => ({
  OpenAIRealtimeWS: class extends EventEmitter {
    socket = new EventEmitter();
    send = vi.fn();
    close = vi.fn();
    constructor(public config: unknown) {
      super();
      mock.sockets.push(this);
      queueMicrotask(() => this.socket.emit('open'));
    }
  },
}));
import { openAITransport } from '@/server/maya/development-transport';
beforeEach(() => {
  vi.clearAllMocks();
  mock.sockets.length = 0;
  vi.stubEnv('OPENAI_API_KEY', 'fake-key-never-transmitted');
  mock.create.mockResolvedValue(
    new Response('fake-sdp-answer', {
      headers: { Location: '/v1/realtime/calls/rtc_fake' },
    }),
  );
  mock.hangup.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
it('uses the documented unified interface and pinned model without returning API credentials', async () => {
  const transport = openAITransport();
  expect(await transport.create('fake-sdp')).toEqual({
    sdp: 'fake-sdp-answer',
    callId: 'rtc_fake',
  });
  expect(mock.create).toHaveBeenCalledWith(
    expect.objectContaining({
      sdp: 'fake-sdp',
      session: expect.objectContaining({
        type: 'realtime',
        model: 'gpt-realtime-2.1',
        max_output_tokens: 512,
        tracing: null,
        tools: [expect.objectContaining({ name: 'teach_step' })],
      }),
    }),
  );
  const session = mock.create.mock.calls[0][0].session;
  expect(session.audio.input.turn_detection.create_response).toBe(false);
  expect(JSON.stringify(session)).not.toContain('studentReference');
  expect(mock.options).toHaveBeenCalledWith(
    expect.objectContaining({ maxRetries: 0, timeout: 8000 }),
  );
});
it('requires an identifiable provider call for server-side control', async () => {
  mock.create.mockResolvedValueOnce(
    new Response('fake', { headers: { Location: '/uncontrolled' } }),
  );
  await expect(openAITransport().create('fake-sdp')).rejects.toThrow(
    'identifiable',
  );
});
it('attaches a bounded authenticated sideband and uses the documented hangup operation', async () => {
  const transport = openAITransport(),
    connection = await transport.attach('rtc_fake', vi.fn(), vi.fn());
  expect(mock.sockets[0]).toHaveProperty('config', {
    callID: 'rtc_fake',
    options: { handshakeTimeout: 5000, maxPayload: 100000 },
  });
  connection.send({ type: 'response.cancel' });
  connection.close();
  await transport.hangup('rtc_fake');
  expect(mock.hangup).toHaveBeenCalledWith('rtc_fake');
});
it('records only allowlisted error metadata, excluding provider messages and identifiers', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const receive = vi.fn();
    const connection = await openAITransport().attach(
      'rtc_fake',
      receive,
      vi.fn(),
    );
    const socket = mock.sockets[0] as EventEmitter;
    const error = {
      type: 'error',
      event_id: 'private-event-id',
      error: {
        type: 'invalid_request_error',
        code: 'invalid_value',
        param: 'response.max_output_tokens',
        message: 'private prompt and sk-secret-key',
      },
    };
    socket.emit('event', error);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      event: 'maya_provider_failure',
      code: 'invalid_value',
      param: 'response.max_output_tokens',
    });
    socket.emit('event', {
      ...error,
      error: {
        ...error.error,
        code: 'sk-private-secret',
        param: 'private-data',
      },
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|sk-secret/);
    expect(receive).toHaveBeenCalledWith(error);
    connection.close();
  } finally {
    log.mockRestore();
  }
});
