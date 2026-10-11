import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
function localConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local classroom fixtures only');
  return { url, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! };
}
async function family() {
  const { url, key } = localConfig(),
    email = `maya-${randomUUID()}@example.test`,
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
    p_display_name: 'Synthetic Maya learner',
    p_grade: 8,
  });
  expect(student.error).toBeNull();
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  const enrolled = await client.rpc('enroll_parent_student', {
    p_request_id: randomUUID(),
    p_student_id: student.data!,
    p_version_id: '00000000-0000-0000-0000-000000000101',
    p_preferences: {
      schemaVersion: 1,
      timezone: 'UTC',
      lessonDurationMinutes: 30,
      weeklyFrequency: 1,
      slots: [{ weekday: 1, time: '16:00' }],
      earliestDate: date.toISOString().slice(0, 10),
    },
  });
  expect(enrolled.error).toBeNull();
  const reservations = await client
    .from('lesson_schedules')
    .select('*')
    .eq('student_id', student.data!)
    .order('lesson_position');
  expect(reservations.error).toBeNull();
  return {
    email,
    password,
    client,
    admin,
    studentId: student.data!,
    reservations: reservations.data!,
  };
}
async function enter(page: Page, a: Awaited<ReturnType<typeof family>>) {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(a.email);
  await page.getByLabel('Password', { exact: true }).fill(a.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/parent');
  await page
    .getByRole('button', { name: 'Open student preview', exact: true })
    .click();
  await expect(page).toHaveURL(`/preview/${a.studentId}`);
  await page
    .getByRole('link', {
      name: 'Open supervised classroom preview',
      exact: true,
    })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Maya’s classroom' }),
  ).toBeVisible();
}
test('mock Maya coordinates narrated steps, rejects interrupted commands, recovers board work and stays media-free on mobile', async ({
  page,
}) => {
  const a = await family();
  let externalCalls = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).hostname.endsWith('openai.com')) externalCalls++;
  });
  await page.addInitScript(() => {
    (window as unknown as { mediaCalls: number }).mediaCalls = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      (window as unknown as { mediaCalls: number }).mediaCalls++;
      throw new Error('No capture in mock mode');
    };
  });
  await enter(page, a);
  await expect(
    page.getByRole('button', { name: 'Start Maya simulation', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Start classroom preview', exact: true })
    .click();
  await expect(page.getByTestId('lesson-state')).toHaveText('active');
  await page
    .getByRole('button', { name: 'Start Maya simulation', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Continue Maya simulation', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Continue Maya simulation', exact: true })
    .click();
  await expect(page.getByTestId('maya-narration')).toContainText(
    'signed integers',
  );
  await expect(page.getByTestId('maya-state')).toHaveText(
    'Narrating · simulated',
  );
  await page
    .getByRole('button', { name: 'Interrupt Maya', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Continue Maya simulation', exact: true }),
  ).toBeEnabled();
  const endpoint = page.url() + '/events';
  const replay = await (await page.request.get(endpoint)).json();
  const speech = replay.events.find(
    (e: { kind: string }) => e.kind === 'maya_explanation_started',
  ).payload.speechId;
  const stale = await page.request.post(endpoint, {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      kind: 'maya',
      input: {
        commandId: randomUUID(),
        expectedEpoch: 0,
        action: 'apply',
        speechId: speech,
      },
    },
  });
  expect(stale.status()).toBe(400);
  await page.waitForTimeout(2000);
  await expect(page.locator('[data-maya-command]')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Continue Maya simulation', exact: true })
    .click();
  await expect(page.locator('[data-maya-command]')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Next teaching step', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Next teaching step', exact: true })
    .click();
  await expect(page.locator('[data-maya-command]')).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Next teaching step', exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.locator('[data-maya-command]')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Next teaching step', exact: true })
    .click();
  await expect(page.getByTestId('maya-question')).toContainText(
    'Why is the result positive',
  );
  await expect(page.locator('[data-maya-command]')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Ask for a hint · simulated', exact: true })
    .click();
  await expect(
    page.getByText('Which is larger:', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Try a simulated response', exact: true })
    .click();
  await expect(
    page.getByText('Simulated learner:', { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Microphone off — disabled' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Camera off — disabled' }),
  ).toBeDisabled();
  await page.context().setOffline(true);
  await expect(page.getByRole('status')).toHaveText('Reconnecting');
  await page.context().setOffline(false);
  await expect(page.getByRole('status')).toHaveText('Connected');
  await expect(page.locator('[data-maya-command]')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Stop Maya simulation', exact: true })
    .click();
  await expect(page.getByTestId('maya-state')).toHaveText('Simulation stopped');
  await page.reload();
  await expect(page.getByTestId('maya-state')).toHaveText('Simulation stopped');
  await expect(page.locator('[data-maya-command]')).toHaveCount(3);
  expect(externalCalls).toBe(0);
  // A shared clear must work even when only Maya objects are on the board.
  await expect(
    page.getByRole('button', { name: 'Clear board', exact: true }),
  ).toBeEnabled();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Clear board', exact: true }).click();
  await expect(page.locator('[data-maya-command]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-maya-command]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { mediaCalls: number }).mediaCalls,
    ),
  ).toBe(0);
  const evidence = await a.admin
    .from('student_skills')
    .select('evidence_count,assessment_state')
    .eq('student_id', a.studentId);
  expect(
    evidence.data?.every(
      (s) => s.evidence_count === 0 && s.assessment_state === 'unassessed',
    ),
  ).toBe(true);
  expect(
    (
      await a.admin
        .from('homework_assignments')
        .select('id')
        .eq('student_id', a.studentId)
    ).data,
  ).toEqual([]);
  expect(
    (
      await a.admin
        .from('lesson_schedules')
        .select('status')
        .eq('id', a.reservations[0].id)
        .single()
    ).data?.status,
  ).toBe('scheduled');
});
test('mock teaching cannot be activated by parent mode, foreign sessions or provider/role injection; competing retries are idempotent', async ({
  page,
  request,
}) => {
  const a = await family(),
    b = await family(),
    schedule = a.reservations[0].id;
  expect(
    (
      await a.client.rpc('maya_mock_operation', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_epoch: 0,
        p_action: 'start',
      })
    ).error?.code,
  ).toBe('42501');
  expect(
    (await a.client.rpc('begin_student_preview', { p_student_id: a.studentId }))
      .error,
  ).toBeNull();
  expect(
    (
      await a.client.rpc('classroom_lifecycle', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_action: 'start',
      })
    ).error,
  ).toBeNull();
  const commandId = randomUUID();
  const retries = await Promise.all(
    [1, 2].map(() =>
      a.client.rpc('maya_mock_operation', {
        p_schedule_id: schedule,
        p_request_id: commandId,
        p_epoch: 0,
        p_action: 'start',
      }),
    ),
  );
  expect(retries.every((r) => !r.error)).toBe(true);
  const room = (
    await a.client.rpc('classroom_replay', {
      p_schedule_id: schedule,
      p_after: 0,
    })
  ).data as { events: { kind: string }[]; lesson: { id: string } };
  expect(
    room.events.filter((e) => e.kind === 'maya_session_started'),
  ).toHaveLength(1);
  expect(
    (
      await a.admin
        .from('lesson_plans')
        .select('lesson_id')
        .eq('lesson_id', room.lesson.id)
    ).data,
  ).toHaveLength(1);
  expect(
    (await b.client.rpc('begin_student_preview', { p_student_id: b.studentId }))
      .error,
  ).toBeNull();
  expect(
    (
      await b.client.rpc('maya_mock_operation', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_epoch: 0,
        p_action: 'start',
      })
    ).error?.code,
  ).toBe('42501');
  expect(
    (
      await a.client.rpc('classroom_append', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_epoch: 0,
        p_command: { kind: 'write_math', payload: { text: 'forged' } },
      })
    ).error?.code,
  ).toBe('22023');
  const anon = await request.post(
    `/preview/${a.studentId}/classroom/${schedule}/events`,
    {
      headers: { Origin: 'http://127.0.0.1:3000' },
      data: {
        kind: 'maya',
        input: {
          commandId: randomUUID(),
          expectedEpoch: 0,
          action: 'start',
          speechId: null,
        },
      },
    },
  );
  expect(anon.status()).not.toBe(200);
  await a.client.rpc('end_student_preview');
  await enter(page, b);
  await page
    .getByRole('button', { name: 'Start classroom preview', exact: true })
    .click();
  await expect(page.getByTestId('lesson-state')).toHaveText('active');
  const forged = await page.request.post(page.url() + '/events', {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      kind: 'maya',
      input: {
        commandId: randomUUID(),
        expectedEpoch: 0,
        action: 'start',
        speechId: null,
        provider: 'openai',
        role: 'ADMIN',
      },
    },
  });
  expect(forged.status()).toBe(400);
  await page.goto(`/preview/${b.studentId}/classroom/${schedule}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});
