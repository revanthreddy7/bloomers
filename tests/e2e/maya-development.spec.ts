import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('ordinary authenticated parent cannot activate the synthetic developer pathway or acquire provider credentials', async ({
  page,
}) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local synthetic fixtures only.');
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const email = `developer-denial-${randomUUID()}@example.test`,
    password = `Local-${randomUUID()}!`;
  expect(
    (
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
    ).error,
  ).toBeNull();
  let external = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'api.openai.com') external++;
  });
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
  const response = await page.goto('/developer/maya');
  expect(response?.status()).toBe(404);
  const denied = await page.request.post('/developer/maya/session', {
    headers: { Origin: 'http://localhost:3000' },
    data: {
      action: 'start',
      requestId: randomUUID(),
      sdp: 'synthetic-fake-sdp',
      adultSyntheticOptIn: true,
      role: 'ADMIN',
      developer: true,
    },
  });
  expect(denied.status()).toBe(403);
  expect(denied.headers()['cache-control']).toContain('no-store');
  const guessed = await page.request.get(
    `/developer/maya/session?id=${randomUUID()}`,
  );
  expect(guessed.status()).toBe(403);
  expect(external).toBe(0);
});
if (process.env.MAYA_DEV_BROWSER_FIXTURE) {
  test('actual developer UI coordinates mocked connected voice, dynamic board, pause and cleanup without Next', async ({
    page,
  }) => {
    const fixture = JSON.parse(
      readFileSync(process.env.MAYA_DEV_BROWSER_FIXTURE!, 'utf8'),
    ) as { email: string; password: string };
    await page.addInitScript(() => {
      sessionStorage.removeItem('maya-development-session');
      const track = {
        enabled: true,
        stop: () => {
          track.enabled = false;
        },
      };
      const channel = {
        readyState: 'open',
        onopen: null,
        onclose: null,
        onmessage: null as null | ((e: { data: string }) => void),
        send: () => {},
        close: () => {
          channel.readyState = 'closed';
        },
      };
      class FakePeer {
        connectionState = 'connected';
        ontrack = null;
        onconnectionstatechange = null;
        addTrack() {}
        createDataChannel() {
          return channel;
        }
        async createOffer() {
          return { sdp: 'fake-sdp-no-provider' };
        }
        async setLocalDescription() {}
        async setRemoteDescription() {
          setTimeout(
            () =>
              channel.onmessage?.({
                data: JSON.stringify({
                  type: 'output_audio_buffer.started',
                  response_id: 'mock-audio',
                }),
              }),
            300,
          );
        }
        close() {
          this.connectionState = 'closed';
        }
      }
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: async () => ({
          getTracks: () => [track],
          getAudioTracks: () => [track],
        }),
      });
      Object.defineProperty(window, 'RTCPeerConnection', { value: FakePeer });
      HTMLMediaElement.prototype.play = async () => {};
      HTMLMediaElement.prototype.pause = () => {};
    });
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(fixture.email);
    await page.getByLabel('Password', { exact: true }).fill(fixture.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/parent$/);
    // Browser-only prop replacement; actual server authorization stays disabled.
    await page.route('**/developer/maya', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const replaced = body
        .replaceAll('"ready":false', '"ready":true')
        .replaceAll('\\"ready\\":false', '\\"ready\\":true');
      if (replaced === body) throw new Error('Mock ready prop unavailable.');
      await route.fulfill({ response, body: replaced });
    });
    await page.goto('/developer/maya');
    const id = randomUUID(),
      turnId = randomUUID();
    const snapshot = {
      id,
      status: 'active',
      epoch: 0,
      stopAt: Date.now() + 60000,
      events: [] as unknown[],
      pending: { turnId, responseId: 'mock-audio', epoch: 0 } as null | {
        turnId: string;
        responseId: string;
        epoch: number;
      },
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
    await page.route('**/developer/maya/session', async (route) => {
      const request = route.request().postDataJSON();
      actions.push(request.action);
      if (request.action === 'ack') {
        snapshot.pending = null;
        snapshot.events.push({
          id: randomUUID(),
          lessonId: id,
          sequence: 1,
          epoch: 0,
          protocolVersion: 1,
          source: 'maya_development',
          kind: 'board_applied',
          createdAt: new Date().toISOString(),
          payload: {
            command: {
              protocolVersion: 1,
              commandId: turnId,
              lessonId: id,
              sequence: 1,
              actor: 'maya',
              epoch: 0,
              action: {
                kind: 'write_math',
                text: '−3 + 7',
                at: { x: 0.1, y: 0.2 },
              },
            },
          },
        });
      }
      if (request.action === 'pause') snapshot.status = 'paused';
      if (request.action === 'resume') snapshot.status = 'active';
      if (request.action === 'stop') {
        snapshot.status = 'ended';
        snapshot.metrics.terminationConfirmed = true;
      }
      await route.fulfill({
        json:
          request.action === 'start'
            ? { sdp: 'fake-answer', snapshot }
            : snapshot,
      });
    });
    await page.route('https://api.openai.com/**', (route) => route.abort());
    await page.getByRole('checkbox').check();
    await expect(
      page.getByRole('button', { name: 'Start approved voice test' }),
    ).toBeEnabled();
    await page
      .getByRole('button', { name: 'Start approved voice test' })
      .click();
    await expect(page.getByRole('status')).toContainText('Microphone active');
    await expect(
      page.getByRole('img', { name: 'Synthetic shared mathematics board' }),
    ).toContainText('−3 + 7');
    expect(actions.indexOf('ready')).toBeGreaterThan(actions.indexOf('start'));
    expect(actions).toContain('ack');
    await expect(
      page.getByRole('button', { name: /Next|Continue/ }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Pause lesson' }).click();
    await expect(page.getByRole('status')).toContainText('Microphone OFF');
    await page.getByRole('button', { name: 'Resume lesson' }).click();
    await expect(page.getByRole('status')).toContainText('Microphone active');
    await page.getByRole('button', { name: 'Stop and disconnect' }).click();
    await expect(page.getByRole('status')).toContainText('Microphone OFF');
    await expect(
      page.getByText('Session ended.', { exact: false }),
    ).toBeVisible();
    expect(actions).toContain('stop');
  });
  test('operator-allowlisted synthetic developer can inspect the classroom with capture and billable start disabled', async ({
    page,
  }) => {
    const fixture = JSON.parse(
      readFileSync(process.env.MAYA_DEV_BROWSER_FIXTURE!, 'utf8'),
    ) as { email: string; password: string };
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: async () => {
          throw new Error('Unexpected media capture in disabled validation.');
        },
      });
    });
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill(fixture.email);
    await page.getByLabel('Password', { exact: true }).fill(fixture.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/parent$/);
    await page.goto('/developer/maya');
    await expect(
      page.getByRole('heading', { name: 'Maya developer classroom' }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Microphone OFF');
    await page.getByRole('checkbox').check();
    await expect(
      page.getByRole('button', { name: 'Start approved voice test' }),
    ).toBeDisabled();
    await expect(page.getByText(/Live connection disabled:/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await page.request.post('/developer/maya/session', {
          headers: { Origin: 'http://localhost:3000' },
          data: {
            action: 'start',
            requestId: randomUUID(),
            sdp: 'synthetic-fake-sdp',
            adultSyntheticOptIn: true,
          },
        })
      ).status(),
    ).toBe(403);
  });
}
