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
    onFailure: () => void,
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
          max_output_tokens: 256,
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
        ws.on('error', () => {
          if (!intentional) onFailure();
        });
        ws.on('event', onEvent);
        ws.socket.on('close', () => {
          if (!intentional) onFailure();
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
      await client.realtime.calls.hangup(callId);
    },
  };
}
