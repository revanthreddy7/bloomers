import { z } from 'zod';
import { toolInputSchema } from './contracts';
// Inactive transport: no UI or credential endpoint can start it in Phase 6.
// Browser checks are defensive UX only; server authorization must precede a grant.
export const voiceGrantSchema = z.strictObject({
  value: z.string().min(1).max(4096),
  expiresAt: z.number().int().positive(),
  stopAt: z.number().int().positive(),
  fixture: z.literal('approved_synthetic_adult'),
  model: z.literal('gpt-realtime-2.1'),
});
export type VoiceGrant = z.infer<typeof voiceGrantSchema>;
export type VoiceState =
  'off' | 'connecting' | 'listening' | 'speaking' | 'interrupted';
export class InactiveWebRTCVoice {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private abort: AbortController | null = null;
  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly onState: (state: VoiceState) => void,
    private readonly onProposal: (value: unknown) => void,
  ) {}
  async connect(value: VoiceGrant, explicitOptIn: boolean) {
    const grant = voiceGrantSchema.parse(value),
      now = Date.now();
    if (
      !explicitOptIn ||
      grant.expiresAt <= now ||
      grant.stopAt <= now ||
      grant.stopAt > now + 300000
    )
      throw new Error('Voice permission or connection grant unavailable.');
    this.stop();
    const generation = this.generation;
    this.onState('connecting');
    this.abort = new AbortController();
    this.timer = setTimeout(
      () => this.stop(),
      Math.min(grant.stopAt - now, 10000),
    );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const peer = new RTCPeerConnection();
      this.peer = peer;
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
      peer.ontrack = (event) => {
        this.audio.srcObject = event.streams[0];
        void this.audio.play().catch(() => this.stop());
      };
      peer.onconnectionstatechange = () => {
        if (
          ['failed', 'disconnected', 'closed'].includes(peer.connectionState)
        ) {
          this.stop();
          this.onState('interrupted');
        }
      };
      this.channel = peer.createDataChannel('oai-events');
      this.channel.onmessage = (event) => {
        if (
          generation !== this.generation ||
          typeof event.data !== 'string' ||
          event.data.length > 20000
        )
          return;
        let data: unknown;
        try {
          data = JSON.parse(event.data);
        } catch {
          this.stop();
          return;
        }
        const envelope = z
          .object({ type: z.string().max(100) })
          .safeParse(data);
        if (!envelope.success) {
          this.stop();
          return;
        }
        if (envelope.data.type === 'output_audio_buffer.started')
          this.onState('speaking');
        else if (envelope.data.type === 'output_audio_buffer.stopped')
          this.onState('listening');
        else if (
          envelope.data.type === 'response.function_call_arguments.done'
        ) {
          const call = z
            .object({
              name: z.string().max(100),
              arguments: z.string().max(10000),
            })
            .safeParse(data);
          if (!call.success) {
            this.stop();
            return;
          }
          try {
            const proposal = toolInputSchema.parse({
              name: call.data.name,
              arguments: JSON.parse(call.data.arguments),
            });
            this.onProposal(proposal);
          } catch {
            this.stop();
          }
        } else if (envelope.data.type === 'error') this.stop();
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${grant.value}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
        signal: this.abort.signal,
      });
      if (
        !response.ok ||
        generation !== this.generation ||
        Date.now() >= grant.expiresAt
      )
        throw new Error('Voice connection failed or credential expired.');
      await peer.setRemoteDescription({
        type: 'answer',
        sdp: await response.text(),
      });
      if (generation !== this.generation) return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(
        () => this.stop(),
        Math.max(0, grant.stopAt - Date.now()),
      );
      this.onState('listening');
    } catch {
      this.stop();
      this.onState('interrupted');
      throw new Error('Voice session failed. No automatic reconnection.');
    }
  }
  interrupt() {
    if (this.channel?.readyState === 'open') {
      this.channel.send(JSON.stringify({ type: 'response.cancel' }));
      this.channel.send(JSON.stringify({ type: 'output_audio_buffer.clear' }));
    }
    this.onState('listening');
  }
  stop() {
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.abort?.abort();
    this.abort = null;
    this.channel?.close();
    this.channel = null;
    if (this.peer) {
      this.peer.onconnectionstatechange = null;
      this.peer.ontrack = null;
      this.peer.close();
      this.peer = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.audio.pause();
    this.audio.srcObject = null;
    this.onState('off');
  }
}
