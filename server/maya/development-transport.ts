import 'server-only';
import OpenAI from 'openai';
import { OpenAIRealtimeWS } from 'openai/realtime/ws';
import type { RealtimeClientEvent } from 'openai/resources/realtime/realtime';
import { createHash, randomUUID } from 'node:crypto';
import {
  developmentInstructions,
  developmentTool,
} from '@/features/maya/development';
export interface DevelopmentConnection {
  send(event: RealtimeClientEvent): void;
  close(): void;
}
export interface DevelopmentTransport {
  create(sdp: string): Promise<{ sdp: string; callId: string }>;
  attach(
    callId: string,
    onEvent: (event: unknown) => void,
    onFailure: (detail?: { stage: string; closeCode?: number }) => void,
  ): Promise<DevelopmentConnection>;
  hangup(callId: string): Promise<void>;
}
export function openAITransport(): DevelopmentTransport {
  const attemptId = randomUUID(),
    began = Date.now();
  const reference = (callId: string) =>
    createHash('sha256').update(callId).digest('hex').slice(0, 16);
  const requestId = (id: unknown) =>
    typeof id === 'string' && /^req_[A-Za-z0-9_-]{1,180}$/.test(id) ? id : null;
  const log = (stage: string, detail: Record<string, unknown> = {}) =>
    console.info(
      JSON.stringify({
        event: 'maya_connection_diagnostic',
        attemptId,
        stage,
        durationMs: Date.now() - began,
        ...detail,
      }),
    );
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
    timeout: 8000,
    maxRetries: 0,
  });
  return {
    async create(sdp) {
      log('create_requested');
      let response: Response;
      try {
        response = await client.realtime.calls.create(
          {
            sdp,
            session: {
              type: 'realtime',
              model: 'gpt-realtime-2.1',
              instructions: developmentInstructions,
              output_modalities: ['audio'],
              max_output_tokens: 512,
              tracing: null,
              tools: [developmentTool],
              tool_choice: 'auto',
              parallel_tool_calls: false,
              audio: {
                input: {
                  turn_detection: {
                    type: 'server_vad',
                    create_response: false,
                    interrupt_response: false,
                    silence_duration_ms: 1000,
                  },
                },
                output: { voice: 'marin' },
              },
            },
          },
          { headers: { 'X-Client-Request-Id': attemptId } },
        );
      } catch (error) {
        log('create_failed', {
          httpStatus:
            error instanceof OpenAI.APIError ? (error.status ?? null) : null,
          providerRequestId:
            error instanceof OpenAI.APIError
              ? requestId(error.requestID)
              : null,
        });
        throw error;
      }
      const location = response.headers.get('location');
      const match =
        location &&
        new URL(location, 'https://api.openai.com').pathname.match(
          /^\/v1\/realtime\/calls\/(rtc_[A-Za-z0-9_-]+)$/,
        );
      if (!response.ok || !match)
        throw new Error(
          'Provider did not return an identifiable controlled call.',
        );
      log('sdp_answer_received', {
        callReference: reference(match[1]),
        httpStatus: response.status,
        providerRequestId: requestId(response.headers.get('x-request-id')),
      });
      const answer = await response.text();
      if (answer.length > 30000)
        throw new Error('Provider SDP exceeds its bounds.');
      return { sdp: answer, callId: match[1] };
    },
    attach(callId, onEvent, onFailure) {
      const clientRequestId = `${attemptId}-sideband`;
      log('sideband_requested', {
        callReference: reference(callId),
        clientRequestId,
      });
      return new Promise((resolve, reject) => {
        const ws = new OpenAIRealtimeWS(
          {
            callID: callId,
            options: {
              handshakeTimeout: 5000,
              maxPayload: 100000,
              headers: { 'X-Client-Request-Id': clientRequestId },
            },
          },
          client,
        );
        let opened = false,
          intentional = false;
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('Sideband setup timed out.'));
        }, 6000);
        ws.on('error', (error) => {
          // Never log the raw SDK message: it can include prompts or credentials.
          const status = error.message.match(
            /Unexpected server response: (\d{3})/,
          )?.[1];
          console.info(
            JSON.stringify({
              event: 'maya_sideband_failure',
              attemptId,
              callReference: reference(callId),
              durationMs: Date.now() - began,
              category: status
                ? 'http_handshake'
                : error.message.includes('could not send data')
                  ? 'send'
                  : error.message.includes('could not parse websocket event')
                    ? 'parse'
                    : error.error
                      ? 'provider_event'
                      : 'transport',
              httpStatus: status ? Number(status) : null,
            }),
          );
          if (!intentional) onFailure({ stage: 'sideband_error' });
        });
        ws.on('event', (event) => {
          if (
            event.type === 'session.created' ||
            event.type === 'session.updated'
          )
            log('initial_session_event', {
              callReference: reference(callId),
              eventType: event.type,
            });
          if (event.type === 'error') {
            const code = event.error.code;
            const knownCodes = [
              'invalid_value',
              'invalid_request_error',
              'unknown_parameter',
              'unsupported_parameter',
              'conversation_already_has_active_response',
              'response_cancel_not_active',
              'session_not_ready',
              'rate_limit_exceeded',
              'insufficient_quota',
              'server_error',
              'invalid_api_key',
            ];
            const param = event.error.param;
            console.info(
              JSON.stringify({
                event: 'maya_provider_failure',
                attemptId,
                callReference: reference(callId),
                durationMs: Date.now() - began,
                code: code && knownCodes.includes(code) ? code : 'unrecognized',
                param:
                  param &&
                  /^(response\.)?(max_output_tokens|tool_choice|instructions|output_modalities|conversation|input|model|audio)$/.test(
                    param,
                  )
                    ? param
                    : 'unrecognized',
              }),
            );
          }
          onEvent(event);
        });
        ws.socket.on('close', (code) => {
          log('sideband_closed', {
            callReference: reference(callId),
            closeCode: code,
            intentional,
          });
          if (!intentional)
            onFailure({ stage: 'sideband_closed', closeCode: code });
        });
        ws.socket.on('upgrade', (response) => {
          log('sideband_upgrade', {
            callReference: reference(callId),
            httpStatus: response.statusCode,
            providerRequestId: requestId(response.headers['x-request-id']),
          });
        });
        ws.socket.on('open', () => {
          opened = true;
          clearTimeout(timer);
          log('sideband_open', { callReference: reference(callId) });
          resolve({
            send(event) {
              // Only the reviewed orchestrator emits these documented events.
              ws.send(event);
            },
            close() {
              intentional = true;
              clearTimeout(timer);
              ws.close();
            },
          });
        });
        ws.socket.on('error', () => {
          if (!opened) {
            clearTimeout(timer);
            reject(new Error('Sideband unavailable.'));
          }
        });
      });
    },
    async hangup(callId) {
      const clientRequestId = randomUUID();
      log('hangup_requested', {
        callReference: reference(callId),
        clientRequestId,
      });
      try {
        await client.realtime.calls.hangup(callId, {
          headers: { 'X-Client-Request-Id': clientRequestId },
        });
        log('hangup_acknowledged', { callReference: reference(callId) });
      } catch (error) {
        console.info(
          JSON.stringify({
            event: 'maya_hangup_failure',
            clientRequestId,
            attemptId,
            callReference: reference(callId),
            durationMs: Date.now() - began,
            providerRequestId:
              error instanceof OpenAI.APIError
                ? requestId(error.requestID)
                : null,
            httpStatus:
              error instanceof OpenAI.APIError ? (error.status ?? null) : null,
          }),
        );
        throw error;
      }
    },
  };
}
