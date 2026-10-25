import 'server-only';
import OpenAI from 'openai';
import { SidebandWS } from 'openai/resources/live/sideband/ws';
import type { ConnectClientEvent } from 'openai/resources/live/sideband/sideband';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { liveGreeting, liveInstructions } from '@/features/maya/development';

export interface LiveConnection {
  send(event: ConnectClientEvent): void;
  close(): void;
}
export interface LiveTransport {
  create(sdp: string): Promise<{ sdp: string; callId: string }>;
  attach(
    id: string,
    event: (value: unknown) => void,
    failure: () => void,
  ): Promise<LiveConnection>;
  finish(id: string): Promise<void>;
}
// Existing SDK supports Live. No dependency upgrade, ephemeral key or automatic retry.
export function openAILiveTransport(): LiveTransport {
  const client = new OpenAI({ maxRetries: 0, timeout: 8000 });
  const attemptId = randomUUID(),
    began = Date.now();
  const active = new Map<
    string,
    { connection: LiveConnection; final: Promise<void> }
  >();
  const log = (
    stage: string,
    id?: string,
    status?: number,
    requestId?: string | null,
  ) =>
    console.info(
      JSON.stringify({
        event: 'maya_live_connection',
        attemptId,
        stage,
        durationMs: Date.now() - began,
        callReference: id
          ? createHash('sha256').update(id).digest('hex').slice(0, 16)
          : undefined,
        httpStatus: status,
        providerRequestId:
          requestId && /^req_[\w-]{1,180}$/.test(requestId)
            ? requestId
            : undefined,
      }),
    );
  const transport: LiveTransport = {
    async create(sdp) {
      log('create_requested');
      try {
        const { data, response } = await client.live
          .create(
            {
              session: {
                model: 'gpt-live-1',
                store: false,
                instructions: liveInstructions,
                audio: { output: { voice: 'marin' } },
                delegation: { type: 'client' },
                input: [
                  {
                    type: 'message',
                    role: 'developer',
                    content: [{ type: 'input_text', text: liveGreeting }],
                  },
                ],
                client: {
                  data_channel: {
                    allowed_client_events: [],
                    allowed_server_events: [
                      'session.started',
                      'session.closed',
                      'session.input_transcript.delta',
                      'session.output_transcript.delta',
                      'session.usage.updated',
                      'error',
                    ].map((type) => ({ type })),
                  },
                },
              },
              transport: { type: 'webrtc', sdp },
            },
            { headers: { 'X-Client-Request-Id': attemptId } },
          )
          .withResponse();
        const result = z
          .object({
            session: z.object({
              id: z
                .string()
                .min(1)
                .max(200)
                .regex(/^[A-Za-z0-9_-]+$/),
            }),
            transport: z.object({
              type: z.literal('webrtc'),
              sdp: z.string().min(1).max(30000),
            }),
          })
          .parse(data);
        log(
          'sdp_answer_received',
          result.session.id,
          response.status,
          response.headers.get('x-request-id'),
        );
        return { callId: result.session.id, sdp: result.transport.sdp };
      } catch (error) {
        log(
          'create_failed',
          undefined,
          error instanceof OpenAI.APIError ? error.status : undefined,
          error instanceof OpenAI.APIError ? error.requestID : undefined,
        );
        throw new Error('Live session creation failed; no automatic retry.');
      }
    },
    async attach(id, onEvent, onFailure) {
      if (active.has(id)) throw new Error('Sideband already attached.');
      log('sideband_requested', id);
      return new Promise((resolve, reject) => {
        const ws = new SidebandWS(
          client,
          { session_id: id, graceful_close: true },
          {
            reconnect: null,
            handshakeTimeout: 5000,
            maxPayload: 150000,
            headers: { 'X-Client-Request-Id': attemptId + '-sideband' },
          },
        );
        let intentional = false,
          finalized = false,
          opened = false;
        let finalResolve!: () => void;
        const final = new Promise<void>((done) => {
          finalResolve = done;
        });
        const timer = setTimeout(() => {
          intentional = true;
          ws.close();
          reject(new Error('Live sideband timed out.'));
        }, 6000);
        const connection: LiveConnection = {
          send: (event) => ws.send(event),
          close: () => {
            intentional = true;
            clearTimeout(timer);
            ws.close();
            active.delete(id);
          },
        };
        ws.on('event', (event) => {
          if (event.type === 'session.closed') {
            finalized = true;
            finalResolve();
            log('session_finalized', id);
          }
          onEvent(event);
        });
        ws.on('error', (error) => {
          const status = error.message.match(
            /Unexpected server response: (\d{3})/,
          )?.[1];
          log('sideband_error', id, status ? Number(status) : undefined);
          if (!opened) {
            clearTimeout(timer);
            intentional = true;
            ws.close();
            reject(new Error('Live sideband unavailable.'));
          }
          if (!intentional) onFailure();
        });
        ws.on('close', () => {
          clearTimeout(timer);
          log('sideband_closed', id);
          if (!intentional && !finalized) onFailure();
        });
        ws.socket.on('open', () => {
          opened = true;
          clearTimeout(timer);
          active.set(id, { connection, final });
          log('sideband_open', id);
          resolve(connection);
        });
      });
    },
    async finish(id) {
      // Live WebRTC ends through session.close/final session.closed, not the legacy rtc_ hangup API.
      if (!active.has(id))
        await transport.attach(
          id,
          () => {},
          () => {},
        );
      const entry = active.get(id)!;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        log('close_requested', id);
        entry.connection.send({
          type: 'session.close',
          event_id: randomUUID(),
        });
        await Promise.race([
          entry.final,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Finalization unconfirmed.')),
              6000,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
        entry.connection.close();
      }
    },
  };
  return transport;
}
