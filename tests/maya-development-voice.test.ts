import { afterEach, expect, it, vi } from 'vitest';
import { DevelopmentVoice } from '@/features/maya/development-voice';
const id = '65000000-0000-4000-8000-000000000010';
function fixture() {
  const trackStop = vi.fn(),
    channelClose = vi.fn(),
    peerClose = vi.fn(),
    onState = vi.fn(),
    update = vi.fn(),
    getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop: trackStop }],
      getAudioTracks: () => [{ stop: trackStop }],
    }));
  const channel = {
    close: channelClose,
    readyState: 'open',
    send: vi.fn(),
    onmessage: null as ((event: { data: string }) => void) | null,
  };
  class Peer {
    connectionState = 'connected';
    ontrack = null;
    onconnectionstatechange = null;
    addTrack = vi.fn();
    createDataChannel() {
      return channel;
    }
    createOffer = async () => ({ sdp: 'fake-only-sdp' });
    setLocalDescription = vi.fn();
    setRemoteDescription = vi.fn();
    close = peerClose;
  }
  const metrics = {
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
  };
  const snapshot = {
    id,
    status: 'active',
    epoch: 0,
    stopAt: Date.now() + 60000,
    events: [],
    pending: null,
    metrics,
  };
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const action = JSON.parse(init?.body as string).action;
    return new Response(
      JSON.stringify(
        action === 'start'
          ? { sdp: 'fake-answer', snapshot }
          : { ...snapshot, status: action === 'stop' ? 'ended' : 'active' },
      ),
      { status: 200 },
    );
  });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('RTCPeerConnection', Peer);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('sessionStorage', { setItem: vi.fn() });
  const audio = {
    pause: vi.fn(),
    play: vi.fn(async () => {}),
    srcObject: null,
  } as unknown as HTMLAudioElement;
  return {
    voice: new DevelopmentVoice(audio, onState, update),
    getUserMedia,
    trackStop,
    channelClose,
    peerClose,
    fetchMock,
    channel,
    update,
    onState,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('construction and absent explicit opt-in never request capture or external calls', async () => {
  const f = fixture();
  await expect(f.voice.start(false)).rejects.toThrow('opt-in');
  expect(f.getUserMedia).not.toHaveBeenCalled();
  expect(f.fetchMock).not.toHaveBeenCalled();
});
it('successful fake transport uses only authenticated local endpoints and stopping releases tracks and provider control', async () => {
  const f = fixture();
  await f.voice.start(true);
  expect(f.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  await f.voice.stop();
  expect(f.trackStop).toHaveBeenCalledOnce();
  expect(f.peerClose).toHaveBeenCalledOnce();
  expect(f.channelClose).toHaveBeenCalledOnce();
  expect(
    f.fetchMock.mock.calls.every(([url]) => url === '/developer/maya/session'),
  ).toBe(true);
  expect(JSON.stringify(f.fetchMock.mock.calls)).not.toMatch(
    /api.openai.com|Authorization|apiKey/,
  );
});
it('denied setup and malformed provider events clean up without automatic reconnection', async () => {
  const f = fixture();
  f.fetchMock.mockResolvedValueOnce(new Response('{}', { status: 403 }));
  await expect(f.voice.start(true)).rejects.toThrow('setup failed');
  expect(f.trackStop).toHaveBeenCalledOnce();
  const g = fixture();
  await g.voice.start(true);
  g.channel.onmessage?.({ data: 'invalid-json' });
  await Promise.resolve();
  await g.voice.stop();
  expect(g.trackStop).toHaveBeenCalledOnce();
});
it('late microphone permission after stop immediately releases the returned stream', async () => {
  const f = fixture();
  let release!: (value: Awaited<ReturnType<typeof f.getUserMedia>>) => void;
  f.getUserMedia.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = f.voice.start(true);
  await f.voice.stop();
  release({
    getTracks: () => [{ stop: f.trackStop }],
    getAudioTracks: () => [{ stop: f.trackStop }],
  });
  await pending;
  expect(f.trackStop).toHaveBeenCalledOnce();
  expect(f.fetchMock).not.toHaveBeenCalled();
});
