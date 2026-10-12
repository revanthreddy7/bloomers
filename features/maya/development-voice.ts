import { z } from 'zod';
import { developerSnapshotSchema, type DeveloperSnapshot } from './development';
import type { VoiceState } from './voice';
export type DevelopmentVoiceState = VoiceState | 'paused' | 'permission';
export class DevelopmentVoice {
  private peer: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private channel: RTCDataChannel | null = null;
  private generation = 0;
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private playback = new Set<string>();
  private acknowledged = new Set<string>();
  private polling = false;
  private paused = false;
  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly state: (value: DevelopmentVoiceState) => void,
    private readonly update: (value: DeveloperSnapshot) => void,
  ) {}
  private async post(value: unknown) {
    const response = await fetch('/developer/maya/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Developer operation rejected.');
    return response.json();
  }
  async start(explicitAdultOptIn: boolean) {
    if (!explicitAdultOptIn)
      throw new Error(
        'Explicit adult microphone and synthetic-data opt-in required.',
      );
    this.cleanup();
    const generation = this.generation;
    this.state('permission');
    this.abort = new AbortController();
    this.timer = setTimeout(() => {
      void this.stop();
    }, 15000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.state('connecting');
      const peer = (this.peer = new RTCPeerConnection());
      stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
      peer.ontrack = (event) => {
        this.audio.srcObject = event.streams[0];
        void this.audio.play().catch(() => this.stop());
      };
      peer.onconnectionstatechange = () => {
        if (
          ['failed', 'disconnected', 'closed'].includes(peer.connectionState)
        ) {
          void this.stop();
        }
      };
      const channel = (this.channel = peer.createDataChannel('oai-events'));
      channel.onmessage = (event) => {
        if (
          generation !== this.generation ||
          typeof event.data !== 'string' ||
          event.data.length > 100000
        )
          return;
        try {
          const envelope = z
            .object({
              type: z.string().max(100),
              response_id: z.string().max(200).optional(),
            })
            .parse(JSON.parse(event.data));
          if (this.paused && envelope.type !== 'error') return;
          if (
            envelope.type === 'output_audio_buffer.started' &&
            envelope.response_id
          ) {
            this.playback.add(envelope.response_id);
            this.state('speaking');
          } else if (envelope.type === 'output_audio_buffer.stopped')
            this.state('listening');
          else if (envelope.type === 'input_audio_buffer.speech_started') {
            this.playback.clear();
            this.state('listening');
          } else if (envelope.type === 'error') void this.stop();
        } catch {
          void this.stop();
        }
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const result = z
        .strictObject({
          sdp: z.string().max(30000),
          snapshot: developerSnapshotSchema,
        })
        .parse(
          await this.post({
            action: 'start',
            requestId: crypto.randomUUID(),
            sdp: offer.sdp,
            adultSyntheticOptIn: true,
          }),
        );
      this.sessionId = result.snapshot.id;
      sessionStorage.setItem('maya-development-session', this.sessionId);
      if (generation !== this.generation) {
        await this.post({ action: 'stop', sessionId: this.sessionId });
        this.sessionId = null;
        return;
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: result.sdp });
      await new Promise<void>((resolve, reject) => {
        const began = Date.now();
        const interval = setInterval(() => {
          if (
            generation !== this.generation ||
            Date.now() - began > 15000 ||
            ['failed', 'closed'].includes(peer.connectionState)
          ) {
            clearInterval(interval);
            reject(new Error('Connection stopped or timed out.'));
          } else if (
            peer.connectionState === 'connected' &&
            channel.readyState === 'open'
          ) {
            clearInterval(interval);
            resolve();
          }
        }, 50);
        channel.onclose = () => {
          void this.stop();
        };
      });
      if (generation !== this.generation) return;
      const ready = developerSnapshotSchema.parse(
        await this.post({ action: 'ready', sessionId: this.sessionId }),
      );
      if (generation !== this.generation) return;
      if (ready.status !== 'active') throw new Error('Provider unavailable.');
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(
        () => {
          void this.stop();
        },
        Math.max(0, result.snapshot.stopAt - Date.now()),
      );
      this.state('listening');
      this.update(ready);
      this.poll = setInterval(() => {
        void this.refresh();
      }, 500);
    } catch {
      await this.stop();
      this.state('interrupted');
      throw new Error('Voice setup failed. No automatic reconnection.');
    }
  }
  private async refresh() {
    if (!this.sessionId || this.polling) return;
    this.polling = true;
    try {
      const snapshot = developerSnapshotSchema.parse(
        await this.post({ action: 'heartbeat', sessionId: this.sessionId }),
      );
      this.update(snapshot);
      if (['ended', 'abandoned'].includes(snapshot.status)) {
        this.cleanup();
        return;
      }
      const pending = snapshot.pending;
      if (
        pending &&
        this.playback.has(pending.responseId) &&
        !this.acknowledged.has(pending.turnId)
      ) {
        const ack = developerSnapshotSchema.parse(
          await this.post({
            action: 'ack',
            sessionId: this.sessionId,
            ...pending,
          }),
        );
        this.acknowledged.add(pending.turnId);
        this.update(ack);
      }
    } catch {
      await this.stop();
      this.state('interrupted');
    } finally {
      this.polling = false;
    }
  }
  async interrupt() {
    this.playback.clear();
    if (this.channel?.readyState === 'open')
      this.channel.send(JSON.stringify({ type: 'output_audio_buffer.clear' }));
    if (this.sessionId)
      this.update(
        developerSnapshotSchema.parse(
          await this.post({ action: 'interrupt', sessionId: this.sessionId }),
        ),
      );
  }
  async pause() {
    this.paused = true;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    this.playback.clear();
    if (this.channel?.readyState === 'open')
      this.channel.send(JSON.stringify({ type: 'output_audio_buffer.clear' }));
    if (this.sessionId)
      this.update(
        developerSnapshotSchema.parse(
          await this.post({ action: 'pause', sessionId: this.sessionId }),
        ),
      );
    this.state('paused');
  }
  async resume() {
    if (!this.sessionId) return;
    this.paused = false;
    this.update(
      developerSnapshotSchema.parse(
        await this.post({ action: 'resume', sessionId: this.sessionId }),
      ),
    );
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    this.state('listening');
  }
  private cleanup() {
    this.paused = false;
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    if (this.timer) clearTimeout(this.timer);
    if (this.poll) clearInterval(this.poll);
    this.timer = null;
    this.poll = null;
    if (this.peer) {
      this.peer.onconnectionstatechange = null;
      this.peer.ontrack = null;
      this.peer.close();
    }
    this.peer = null;
    if (this.channel) {
      this.channel.onclose = null;
      this.channel.onopen = null;
      this.channel.onmessage = null;
    }
    this.channel?.close();
    this.channel = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.audio.pause();
    this.audio.srcObject = null;
    this.playback.clear();
    this.acknowledged.clear();
    this.state('off');
  }
  async stop() {
    const id = this.sessionId;
    this.sessionId = null;
    this.cleanup();
    if (id) {
      try {
        this.update(
          developerSnapshotSchema.parse(
            await this.post({ action: 'stop', sessionId: id }),
          ),
        );
      } catch {
        this.state(
          'interrupted',
        ); /* Server heartbeat expiry remains independent. */
      }
    }
  }
}
