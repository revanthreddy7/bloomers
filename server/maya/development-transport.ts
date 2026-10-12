import 'server-only';
import OpenAI from 'openai';
import { OpenAIRealtimeWS } from 'openai/realtime/ws';
import type { RealtimeClientEvent } from 'openai/resources/realtime/realtime';
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
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
    timeout: 8000,
    maxRetries: 0,
  });
  return {
    async create(sdp) {
      const response = await client.realtime.calls.create({
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
      });
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
      const answer = await response.text();
      if (answer.length > 30000)
        throw new Error('Provider SDP exceeds its bounds.');
      return { sdp: answer, callId: match[1] };
    },
    attach(callId, onEvent, onFailure) {
      return new Promise((resolve, reject) => {
        const ws = new OpenAIRealtimeWS(
          {
            callID: callId,
            options: { handshakeTimeout: 5000, maxPayload: 100000 },
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
          if (!intentional)
            onFailure({ stage: 'sideband_closed', closeCode: code });
        });
        ws.socket.on('open', () => {
          opened = true;
          clearTimeout(timer);
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
      try {
        await client.realtime.calls.hangup(callId);
      } catch (error) {
        console.info(
          JSON.stringify({
            event: 'maya_hangup_failure',
            httpStatus:
              error instanceof OpenAI.APIError ? (error.status ?? null) : null,
          }),
        );
        throw error;
      }
    },
  };
}
