import { afterEach, expect, it, vi } from 'vitest';
import { DevelopmentVoice } from '@/features/maya/development-voice';
import type { DeveloperSnapshot } from '@/features/maya/development';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function fixture(failure: 'credential' | 'sdp' | 'sideband' | 'none') {
  vi.useFakeTimers();
  const track = {
    enabled: true,
    readyState: 'live',
    stop: vi.fn(() => {
      track.readyState = 'ended';
    }),
  };
  const channel = {
    readyState: 'open',
    onclose: null,
    onopen: null,
    onmessage: null,
    send: vi.fn(),
    close: vi.fn(() => {
      channel.readyState = 'closed';
    }),
  };
  const peer = {
    connectionState: 'connected',
    ontrack: null,
    onconnectionstatechange: null,
    addTrack: vi.fn(),
    createDataChannel: () => channel,
    createOffer: async () => ({ sdp: 'synthetic-test-sdp' }),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(async () => {
      if (failure === 'sdp') throw new Error('SDP rejected');
    }),
    close: vi.fn(() => {
      peer.connectionState = 'closed';
    }),
  };
  const audio = { play: vi.fn(), pause: vi.fn(), srcObject: {} };
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [track],
        getAudioTracks: () => [track],
      })),
    },
  });
  vi.stubGlobal(
    'RTCPeerConnection',
    class {
      constructor() {
        return peer;
      }
    },
  );
  vi.stubGlobal('sessionStorage', { setItem: vi.fn() });
  const snapshot: DeveloperSnapshot = {
    id: '65000000-0000-4000-8000-000000000001',
    status: 'active',
    epoch: 0,
    stopAt: Date.now() + 60000,
    events: [],
    pending: null,
    metrics: {
      durationMs: 0,
      firstAudioMs: null,
      boardLatencyMs: [],
      coordinationDelayMs: [],
      interruptionMs: [],
      responseLatencyMs: [],
      staleRejected: 0,
      failures: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCents: 0,
      usageComplete: false,
      terminationConfirmed: false,
    },
  };
  const actions: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(init.body as string);
      actions.push(request.action);
      if (request.action === 'start' && failure === 'credential')
        return { ok: false };
      if (request.action === 'ready' && failure === 'sideband')
        snapshot.status = 'abandoned';
      if (request.action === 'stop' && snapshot.status === 'active')
        snapshot.status = 'ended';
      return {
        ok: true,
        json: async () =>
          request.action === 'start'
            ? { sdp: 'synthetic-answer', snapshot }
            : snapshot,
      };
    }),
  );
  const voice = new DevelopmentVoice(
    audio as unknown as HTMLAudioElement,
    vi.fn(),
    vi.fn(),
  );
  return { voice, track, peer, channel, audio, actions };
}
for (const failure of ['credential', 'sdp', 'sideband'] as const)
  it(`closes every local media resource and timer after ${failure} failure, with no automatic paid retry`, async () => {
    const f = fixture(failure);
    const result = f.voice.start(true).catch((e) => e);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBeInstanceOf(Error);
    expect(f.track.readyState).toBe('ended');
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.peer.connectionState).toBe('closed');
    expect(f.channel.readyState).toBe('closed');
    expect(f.audio.srcObject).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(f.actions.filter((a) => a === 'start')).toHaveLength(1);
    if (failure !== 'credential') expect(f.actions).toContain('stop');
    await vi.advanceTimersByTimeAsync(120000);
    expect(f.actions.filter((a) => a === 'start')).toHaveLength(1);
  });
it('makes explicit stop idempotent and records closed media without delaying remote stop', async () => {
  const f = fixture('none');
  const start = f.voice.start(true);
  await vi.advanceTimersByTimeAsync(100);
  await start;
  await f.voice.stop();
  await f.voice.stop();
  expect(f.track.stop).toHaveBeenCalledOnce();
  expect(f.actions.filter((a) => a === 'stop')).toHaveLength(1);
  expect(f.actions.slice(-2)).toEqual(['stop', 'diagnostic']);
  expect(vi.getTimerCount()).toBe(0);
});
it('cancels an unfinished connection readiness wait immediately on explicit stop', async () => {
  const f = fixture('none');
  f.peer.connectionState = 'connecting';
  const result = f.voice.start(true).catch((e) => e);
  await vi.advanceTimersByTimeAsync(100);
  await f.voice.stop();
  expect(await result).toBeInstanceOf(Error);
  expect(vi.getTimerCount()).toBe(0);
  expect(f.track.readyState).toBe('ended');
  expect(f.actions.filter((a) => a === 'start')).toHaveLength(1);
});
