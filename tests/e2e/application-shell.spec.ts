import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { weekWindow, localDate } from '@/features/application/models';
const versionId = '00000000-0000-0000-0000-000000000101';
function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local fixtures only');
  return { url, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! };
}
async function family(name: string) {
  const { url, key } = config(),
    email = `shell-${randomUUID()}@example.test`,
    password = `Local-${randomUUID()}!`;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  expect(
    (
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
    ).error,
  ).toBeNull();
  const client = createClient(url, key, { auth: { persistSession: false } });
  expect(
    (await client.auth.signInWithPassword({ email, password })).error,
  ).toBeNull();
  expect((await client.rpc('provision_parent')).error).toBeNull();
  const student = await client.rpc('create_parent_student', {
    p_request_id: randomUUID(),
    p_display_name: name,
    p_grade: 8,
  });
  expect(student.error).toBeNull();
  return { email, password, client, studentId: student.data! };
}
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
}
async function sessionClient(page: Page) {
  const { url, key } = config();
  const cookies = (await page.context().cookies())
    .filter((c) => /sb-.*-auth-token(?:\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const encoded = cookies.map((c) => c.value).join('');
  const session = JSON.parse(
    Buffer.from(encoded.slice('base64-'.length), 'base64url').toString('utf8'),
  );
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false },
  });
}
test('parent overview, student switching, canonical schedule and restricted student preview work on desktop and mobile', async ({
  page,
}) => {
  const a = await family('Avery'),
    other = await family('Other family');
  const sibling = await a.client.rpc('create_parent_student', {
    p_request_id: randomUUID(),
    p_display_name: 'Blair',
    p_grade: 7,
  });
  expect(sibling.error).toBeNull();
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  const enrolled = await a.client.rpc('enroll_parent_student', {
    p_request_id: randomUUID(),
    p_student_id: a.studentId,
    p_version_id: versionId,
    p_preferences: {
      schemaVersion: 1,
      timezone: 'America/New_York',
      lessonDurationMinutes: 30,
      weeklyFrequency: 2,
      slots: [
        { weekday: 1, time: '16:00' },
        { weekday: 3, time: '16:00' },
      ],
      earliestDate: date.toISOString().slice(0, 10),
    },
  });
  expect(enrolled.error).toBeNull();
  const schedules = await a.client
    .from('lesson_schedules')
    .select('starts_at')
    .eq('student_id', a.studentId)
    .order('starts_at');
  const first = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(schedules.data![0].starts_at));
  await signIn(page, a.email, a.password);
  await expect(
    page.getByRole('heading', { name: 'Selected student overview' }),
  ).toBeVisible();
  await expect(
    page.getByText('No homework has been assigned.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(first, { exact: true })).toBeVisible();
  await page
    .getByLabel('Selected student', { exact: true })
    .selectOption(sibling.data!);
  await expect(
    page.getByRole('heading', { name: 'Blair’s overview' }),
  ).toBeVisible();
  await expect(
    page.getByText('No course enrollment yet.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(first, { exact: true })).toHaveCount(0);
  await page
    .getByLabel('Selected student', { exact: true })
    .selectOption(a.studentId);
  await expect(
    page.getByRole('heading', { name: 'Avery’s overview' }),
  ).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Parent application' });
  await nav.getByRole('link', { name: 'Course', exact: true }).click();
  await expect(
    page.getByText('Curriculum version 1 · Plan version 1 · Not started'),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'View course roadmap', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(enrolled.data + '$'));
  await nav.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('Not yet assessed', { exact: true })).toHaveCount(
    5,
  );
  await nav.getByRole('link', { name: 'Homework', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'No homework has been assigned.',
      exact: true,
    }),
  ).toBeVisible();
  await nav.getByRole('link', { name: 'Schedule', exact: true }).click();
  await expect(
    page.getByText(/Displayed timezone: America\/New_York/),
  ).toBeVisible();
  const currentWeek = weekWindow(
    new Date().toISOString(),
    'America/New_York',
    0,
  );
  const weekOffset = Math.floor(
    (Date.parse(localDate(schedules.data![0].starts_at, 'America/New_York')) -
      Date.parse(currentWeek.start)) /
      604800000,
  );
  for (let offset = 1; offset <= weekOffset; offset++) {
    await page.getByRole('link', { name: 'Next week', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('week=' + offset + '$'));
  }
  await expect(page.getByText(first + ' – ', { exact: false })).toBeVisible();
  const scheduleText = await page.getByRole('main').textContent();
  await page.reload();
  await expect(page.getByRole('main')).toHaveText(scheduleText!);
  await page.goto(`/parent/learners/${other.studentId}/overview`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await page.goto(`/parent/learners/${a.studentId}/overview`);
  await page
    .getByRole('button', { name: 'Open student preview', exact: true })
    .click();
  await expect(page).toHaveURL(`/preview/${a.studentId}`);
  await expect(
    page.getByText('Parent-assisted student preview', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hi, Avery.' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(`/preview/${a.studentId}`);
  await expect(page.getByRole('heading', { name: 'Hi, Avery.' })).toBeVisible();
  await expect(page.getByLabel('Selected student')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Blair', { exact: true })).toHaveCount(0);
  const scoped = await sessionClient(page);
  expect(
    (await scoped.from('student_profiles').select('id').eq('id', sibling.data!))
      .data,
  ).toEqual([]);
  expect((await scoped.from('parent_profiles').select('user_id')).data).toEqual(
    [],
  );
  expect((await scoped.from('consents').select('id')).data).toEqual([]);
  expect(
    (
      await scoped.rpc('update_parent_student', {
        p_student_id: a.studentId,
        p_display_name: 'Forbidden',
        p_grade: 8,
      })
    ).error?.code,
  ).toBe('42501');
  expect(
    (await scoped.rpc('begin_student_preview', { p_student_id: sibling.data! }))
      .error?.code,
  ).toBe('42501');
  await page.goto('/parent/settings');
  await expect(page).toHaveURL(`/preview/${a.studentId}`);
  await page.goto(`/parent/learners/${sibling.data}/overview`);
  await expect(page).toHaveURL(`/preview/${a.studentId}`);
  await page.goto(`/preview/${sibling.data}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await page.goto(`/preview/${a.studentId}/schedule?week=${weekOffset}`);
  await expect(page.getByText(first + ' – ', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('navigation', { name: 'Student preview navigation' })
    .getByRole('link', { name: 'Course', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Your course', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Student preview navigation' })
    .getByRole('link', { name: 'Progress', exact: true })
    .click();
  await expect(page.getByText('Not yet assessed', { exact: true })).toHaveCount(
    5,
  );
  await page.reload();
  await expect(page.getByText('Not yet assessed', { exact: true })).toHaveCount(
    5,
  );
  await page.getByRole('link', { name: 'Return to parent mode →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Return to parent mode?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'I’m the parent — continue' }).click();
  await expect(page).toHaveURL(`/parent/learners/${a.studentId}/overview`);
  await page
    .getByLabel('Selected student', { exact: true })
    .selectOption(sibling.data!);
  await expect(
    page.getByRole('heading', { name: 'Blair’s overview' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await nav.getByRole('link', { name: 'Homework', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Homework', exact: true }),
  ).toBeVisible();
});
test('preview requires explicit authorized entry and private responses remain uncached', async ({
  page,
  request,
}) => {
  const a = await family('Casey');
  const anonymous = await request.get(`/preview/${a.studentId}`, {
    maxRedirects: 0,
  });
  expect(anonymous.status()).toBe(307);
  expect(anonymous.headers()['cache-control']).toContain('no-store');
  await signIn(page, a.email, a.password);
  await page.goto(`/preview/${a.studentId}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await page.goto(`/parent/learners/${a.studentId}/schedule?week=105`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await page.goto(`/parent/learners/${a.studentId}/overview`);
  await page.getByRole('button', { name: 'Open student preview' }).click();
  await expect(page).toHaveURL(`/preview/${a.studentId}`);
  const response = await page.reload();
  expect(response!.headers()['cache-control']).toContain('no-store');
  await expect(page.getByRole('heading', { name: 'Hi, Casey.' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Join|Start lesson/i }),
  ).toHaveCount(0);
});
