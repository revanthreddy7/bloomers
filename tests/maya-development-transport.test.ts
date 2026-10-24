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
    static APIError = class extends Error {};
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
import OpenAI from 'openai';
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
it('classifies sideband failures without logging raw SDK messages', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const fail = vi.fn();
    const connection = await openAITransport().attach(
      'rtc_fake',
      vi.fn(),
      fail,
    );
    const socket = mock.sockets[0] as EventEmitter;
    socket.emit(
      'error',
      new Error('Unexpected server response: 503 sk-private-key'),
    );
    const failures = log.mock.calls.filter(
      (c) => JSON.parse(c[0]).event === 'maya_sideband_failure',
    );
    expect(JSON.parse(failures[0][0])).toEqual(
      expect.objectContaining({
        event: 'maya_sideband_failure',
        category: 'http_handshake',
        httpStatus: 503,
      }),
    );
    socket.emit('error', new Error('could not send data: private prompt'));
    expect(
      JSON.parse(
        log.mock.calls.filter(
          (c) => JSON.parse(c[0]).event === 'maya_sideband_failure',
        )[1][0],
      ).category,
    ).toBe('send');
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|sk-/);
    expect(fail).toHaveBeenCalledWith({ stage: 'sideband_error' });
    connection.close();
  } finally {
    log.mockRestore();
  }
});
it('keeps hangup failures visible without exposing the error message', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    mock.hangup.mockRejectedValueOnce(
      new Error('private provider response sk-secret'),
    );
    await expect(openAITransport().hangup('rtc_fake')).rejects.toThrow();
    expect(
      JSON.parse(
        log.mock.calls.find(
          (c) => JSON.parse(c[0]).event === 'maya_hangup_failure',
        )![0],
      ),
    ).toEqual(
      expect.objectContaining({
        event: 'maya_hangup_failure',
        httpStatus: null,
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|sk-/);
  } finally {
    log.mockRestore();
  }
});
afterEach(() => vi.unstubAllEnvs());
it('attributes create rejection and HTTP 503 cleanup to safe provider/client request identifiers', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const failure = (status: number, requestID: string) => {
    const e = Object.assign(new Error('private response sk-secret'), {
      status,
      requestID,
    });
    Object.setPrototypeOf(e, OpenAI.APIError.prototype);
    return e;
  };
  try {
    mock.create.mockRejectedValueOnce(failure(401, 'req_create_failure'));
    const transport = openAITransport();
    await expect(transport.create('fake-sdp')).rejects.toThrow();
    const create = JSON.parse(
      log.mock.calls.find(
        (c) => JSON.parse(c[0]).stage === 'create_failed',
      )![0],
    );
    expect(create.httpStatus).toBe(401);
    expect(create.providerRequestId).toBe('req_create_failure');
    expect(mock.create.mock.calls[0][1].headers['X-Client-Request-Id']).toBe(
      create.attemptId,
    );
    mock.hangup.mockRejectedValueOnce(failure(503, 'req_cleanup_failure'));
    await expect(transport.hangup('rtc_fake')).rejects.toThrow();
    const cleanup = JSON.parse(
      log.mock.calls.find(
        (c) => JSON.parse(c[0]).event === 'maya_hangup_failure',
      )![0],
    );
    expect(cleanup.httpStatus).toBe(503);
    expect(cleanup.providerRequestId).toBe('req_cleanup_failure');
    expect(cleanup.callReference).toMatch(/^[a-f0-9]{16}$/);
    expect(mock.hangup).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /sk-secret|private response|rtc_fake/,
    );
  } finally {
    log.mockRestore();
  }
});
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
    expect.objectContaining({
      headers: { 'X-Client-Request-Id': expect.any(String) },
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
    options: {
      handshakeTimeout: 5000,
      maxPayload: 100000,
      headers: { 'X-Client-Request-Id': expect.any(String) },
    },
  });
  connection.send({ type: 'response.cancel' });
  connection.close();
  await transport.hangup('rtc_fake');
  expect(mock.hangup).toHaveBeenCalledWith(
    'rtc_fake',
    expect.objectContaining({
      headers: { 'X-Client-Request-Id': expect.any(String) },
    }),
  );
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
    expect(
      JSON.parse(
        log.mock.calls.find(
          (c) => JSON.parse(c[0]).event === 'maya_provider_failure',
        )![0],
      ),
    ).toEqual(
      expect.objectContaining({
        event: 'maya_provider_failure',
        code: 'invalid_value',
        param: 'response.max_output_tokens',
      }),
    );
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
