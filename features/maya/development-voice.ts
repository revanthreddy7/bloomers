import { z } from 'zod';
import { developerSnapshotSchema, type DeveloperSnapshot } from './development';
import type { VoiceState } from './voice';
export type DevelopmentVoiceState =
  VoiceState | 'paused' | 'permission' | 'thinking';
export class DevelopmentVoice {
  private peer: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private channel: RTCDataChannel | null = null;
  private generation = 0;
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private readiness: { cancel: () => void } | null = null;
  private sessionId: string | null = null;
  private playback = new Set<string>();
  private acknowledged = new Set<string>();
  private polling = false;
  private paused = false;
  private live = false;
  private sessionStarted = false;
  private audible = false;
  private audioContext: AudioContext | null = null;
  private meter: ReturnType<typeof setInterval> | null = null;
  private muted = false;
  private lastSpoken = 0;
  private thinking = false;
  private audioReported = false;
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
      signal: this.abort
        ? AbortSignal.any([this.abort.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Developer operation rejected.');
    return response.json();
  }
  async start(
    explicitAdultOptIn: boolean,
    api: 'live' | 'realtime' = 'realtime',
  ) {
    if (!explicitAdultOptIn)
      throw new Error(
        'Explicit adult microphone and synthetic-data opt-in required.',
      );
    this.cleanup();
    this.live = api === 'live';
    this.sessionStarted = false;
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
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !this.muted;
        peer.addTrack(track, stream);
      });
      peer.ontrack = (event) => {
        const remote = event.streams[0] ?? new MediaStream([event.track]);
        this.audio.srcObject = remote;
        if (this.live && typeof AudioContext !== 'undefined') {
          const context = (this.audioContext = new AudioContext());
          const source = context.createMediaStreamSource(remote);
          const analyser = context.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const samples = new Float32Array(analyser.fftSize);
          void context.resume().catch(() => this.stop());
          let lastSound = 0;
          this.meter = setInterval(() => {
            if (this.paused || generation !== this.generation) return;
            analyser.getFloatTimeDomainData(samples);
            const rms = Math.sqrt(
              samples.reduce((n, v) => n + v * v, 0) / samples.length,
            );
            if (rms > 0.01) lastSound = Date.now();
            this.audible = Date.now() - lastSound < 350;
            this.state(
              this.audible
                ? 'speaking'
                : this.thinking
                  ? 'thinking'
                  : 'listening',
            );
            if (this.audible && !this.audioReported && this.sessionId) {
              this.audioReported = true;
              void this.post({
                action: 'diagnostic',
                sessionId: this.sessionId,
                stage: 'audio_observed',
                peerState: peer.connectionState,
                channelState: this.channel?.readyState ?? 'closed',
                microphoneStopped: false,
              }).catch(() => {});
            }
          }, 100);
        }
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
          if (envelope.type === 'session.started') this.sessionStarted = true;
          if (this.paused && envelope.type !== 'error') return;
          if (this.live) {
            if (envelope.type === 'error' || envelope.type === 'session.closed')
              void this.stop();
            if (envelope.type === 'session.input_transcript.delta') {
              this.playback.clear();
              this.lastSpoken = Date.now();
            }
            return;
          }
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
      await this.post({
        action: 'diagnostic',
        sessionId: this.sessionId,
        stage: 'answer_applied',
        peerState: peer.connectionState,
        channelState: channel.readyState,
        microphoneStopped: false,
      });
      await new Promise<void>((resolve, reject) => {
        const began = Date.now();
        const interval = setInterval(() => {
          if (
            generation !== this.generation ||
            Date.now() - began > 15000 ||
            ['failed', 'closed'].includes(peer.connectionState)
          ) {
            clearInterval(interval);
            this.readiness = null;
            reject(new Error('Connection stopped or timed out.'));
          } else if (
            peer.connectionState === 'connected' &&
            channel.readyState === 'open' &&
            (!this.live || this.sessionStarted)
          ) {
            clearInterval(interval);
            this.readiness = null;
            resolve();
          }
        }, 50);
        this.readiness = {
          cancel: () => {
            clearInterval(interval);
            reject(new Error('Connection explicitly stopped.'));
          },
        };
        channel.onclose = () => {
          void this.stop();
        };
      });
      if (generation !== this.generation) return;
      await this.post({
        action: 'diagnostic',
        sessionId: this.sessionId,
        stage: 'peer_connected',
        peerState: peer.connectionState,
        channelState: channel.readyState,
        microphoneStopped: false,
      });
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
      this.thinking = !!snapshot.metrics.backendPending || !!pending;
      if (this.live && !this.audible && this.thinking) this.state('thinking');
      if (
        pending &&
        (this.live
          ? this.audible &&
            !!pending.responseId &&
            Date.now() - this.lastSpoken > 500
          : this.playback.has(pending.responseId)) &&
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
    if (this.live) {
      await this.pause();
      return;
    }
    this.playback.clear();
    if (this.live) {
      this.audio.muted = true;
      this.audible = false;
    }
    if (!this.live && this.channel?.readyState === 'open')
      this.channel.send(JSON.stringify({ type: 'output_audio_buffer.clear' }));
    if (this.sessionId)
      this.update(
        developerSnapshotSchema.parse(
          await this.post({ action: 'interrupt', sessionId: this.sessionId }),
        ),
      );
    // Output is restored by explicit resume, never an instruction acknowledgment.
    if (this.live) {
      this.paused = true;
      this.state('paused');
    }
  }
  async pause() {
    this.paused = true;
    this.audio.muted = true;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    this.playback.clear();
    if (!this.live && this.channel?.readyState === 'open')
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
    this.audio.muted = false;
    this.update(
      developerSnapshotSchema.parse(
        await this.post({ action: 'resume', sessionId: this.sessionId }),
      ),
    );
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !this.muted;
    });
    this.state('listening');
  }
  async draw(stroke: unknown, expectedEpoch: number) {
    if (!this.sessionId || !this.live)
      throw new Error('Join the approved classroom before drawing.');
    this.update(
      developerSnapshotSchema.parse(
        await this.post({
          action: 'ink',
          sessionId: this.sessionId,
          commandId: crypto.randomUUID(),
          expectedEpoch,
          stroke,
        }),
      ),
    );
  }
  setMicrophoneMuted(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted && !this.paused;
    });
  }
  private cleanup() {
    if (this.meter) clearInterval(this.meter);
    this.meter = null;
    void this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.audible = false;
    this.thinking = false;
    this.audioReported = false;
    this.audio.muted = false;
    this.paused = false;
    this.generation++;
    this.readiness?.cancel();
    this.readiness = null;
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
        // Cleanup telemetry must never delay the remote stop request.
        await this.post({
          action: 'diagnostic',
          sessionId: id,
          stage: 'local_cleanup',
          peerState: 'closed',
          channelState: 'closed',
          microphoneStopped: true,
        }).catch(() => {});
      } catch {
        this.state(
          'interrupted',
        ); /* Server heartbeat expiry remains independent. */
      }
    }
  }
}
