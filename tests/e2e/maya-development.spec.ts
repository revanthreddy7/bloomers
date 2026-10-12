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
