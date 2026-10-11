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
    email = `classroom-${randomUUID()}@example.test`,
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
    p_display_name: 'Classroom learner',
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
async function draw(page: Page) {
  await expect(
    page.getByRole('button', { name: 'Pen', exact: true }),
  ).toBeEnabled();
  await page.getByTestId('whiteboard').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('whiteboard').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.locator('[data-stroke-id]')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeEnabled();
}
test('supervised classroom draws, replays, pauses, resumes, ends and safely returns on desktop/mobile without media capture', async ({
  page,
}) => {
  const a = await family();
  await page.addInitScript(() => {
    (window as unknown as { mediaCalls: number }).mediaCalls = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      (window as unknown as { mediaCalls: number }).mediaCalls++;
      throw new Error('Capture must remain disabled');
    };
  });
  await enter(page, a);
  await expect(page.getByText('Tutor offline', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Microphone off — disabled' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Camera off — disabled' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Show Maya my work · Coming soon' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Start classroom preview', exact: true })
    .click();
  await expect(page.getByTestId('lesson-state')).toHaveText('active');
  await draw(page);
  if (process.env.CLASSROOM_VISUAL_CAPTURE === '1')
    await page.screenshot({
      path: '/tmp/bloomers-classroom-desktop.png',
      fullPage: true,
    });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-stroke-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('[data-stroke-id]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-stroke-id]')).toHaveCount(1);
  const endpoint = page.url() + '/events';
  const blockedOrigin = await page.request.post(endpoint, {
    headers: {
      Origin: 'https://unrelated.example',
      'Content-Type': 'application/json',
    },
    data: {
      kind: 'lifecycle',
      input: { commandId: randomUUID(), action: 'end' },
    },
  });
  expect(blockedOrigin.status()).toBe(403);
  const tooLarge = await page.request.post(endpoint, {
    headers: {
      Origin: new URL(page.url()).origin,
      'Content-Type': 'application/json',
    },
    data: 'x'.repeat(20001),
  });
  expect(tooLarge.status()).toBe(413);
  await page.getByRole('button', { name: 'Pause lesson', exact: true }).click();
  await expect(page.getByTestId('lesson-state')).toHaveText('paused');
  await expect(
    page.getByRole('button', { name: 'Pen', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId('lesson-state')).toHaveText('paused');
  await page
    .getByRole('button', { name: 'Resume lesson', exact: true })
    .click();
  await expect(page.getByTestId('lesson-state')).toHaveText('active');
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  await page.getByTestId('whiteboard').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('whiteboard').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await expect(page.locator('[data-stroke-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await draw(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Clear board', exact: true }).click();
  await expect(page.locator('[data-stroke-id]')).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Clear board', exact: true }).click();
  await expect(page.locator('[data-stroke-id]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByTestId('whiteboard').scrollIntoViewIfNeeded();
  const mobile = (await page.getByTestId('whiteboard').boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: mobile.x + mobile.width * 0.2, y: mobile.y + mobile.height * 0.3 },
    ],
  });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: mobile.x + mobile.width * 0.5, y: mobile.y + mobile.height * 0.5 },
    ],
  });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('[data-stroke-id]')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeEnabled();
  await touch.detach();
  if (process.env.CLASSROOM_VISUAL_CAPTURE === '1')
    await page.screenshot({
      path: '/tmp/bloomers-classroom-mobile.png',
      fullPage: true,
    });
  await page.reload();
  await expect(page.locator('[data-stroke-id]')).toHaveCount(1);
  await page.context().setOffline(true);
  await expect(page.getByText('Reconnecting', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Pen', exact: true }),
  ).toBeDisabled();
  await page.context().setOffline(false);
  await expect(page.getByRole('status')).toHaveText('Connected');
  await expect(page.locator('[data-stroke-id]')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => (window as unknown as { mediaCalls: number }).mediaCalls,
    ),
  ).toBe(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'End lesson preview', exact: true })
    .click();
  await expect(page.getByTestId('lesson-state')).toHaveText('ended');
  await expect(
    page.getByRole('button', { name: 'Pen', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId('lesson-state')).toHaveText('ended');
  await expect(page.locator('[data-stroke-id]')).toHaveCount(1);
  const lesson = await a.client
    .from('lessons')
    .select('id,classroom_mode,status')
    .eq('schedule_id', a.reservations[0].id);
  expect(lesson.data).toHaveLength(1);
  expect(lesson.data![0].classroom_mode).toBe('supervised_preview');
  const schedule = await a.client
    .from('lesson_schedules')
    .select('status')
    .eq('id', a.reservations[0].id)
    .single();
  expect(schedule.data?.status).toBe('scheduled');
  const evidence = await a.client
    .from('student_skills')
    .select('evidence_count,assessment_state')
    .eq('student_id', a.studentId);
  expect(
    evidence.data?.every(
      (s) => s.evidence_count === 0 && s.assessment_state === 'unassessed',
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Return to parent mode →' }).click();
  await page.getByRole('button', { name: 'I’m the parent — continue' }).click();
  await expect(page).toHaveURL(`/parent/learners/${a.studentId}/overview`);
  await expect(
    page.getByText(
      'Lessons haven’t started yet. No completed attendance records are available.',
    ),
  ).toBeVisible();
});
test('classroom RPCs serialize competing starts and reject foreign, forged, stale and unauthorized writes', async ({
  page,
  request,
}) => {
  const a = await family(),
    b = await family(),
    schedule = a.reservations[0].id;
  const anonymous = await request.get(
    `/preview/${a.studentId}/classroom/${schedule}`,
    { maxRedirects: 0 },
  );
  expect(anonymous.status()).toBe(307);
  expect(anonymous.headers()['cache-control']).toContain('no-store');
  expect(
    (
      await a.client.rpc('classroom_lifecycle', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_action: 'start',
      })
    ).error?.code,
  ).toBe('42501');
  expect(
    (await a.client.rpc('begin_student_preview', { p_student_id: a.studentId }))
      .error,
  ).toBeNull();
  const starts = await Promise.all(
    [1, 2].map(() =>
      a.client.rpc('classroom_lifecycle', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_action: 'start',
      }),
    ),
  );
  expect(starts.every((s) => !s.error)).toBe(true);
  expect(starts[0].data).toBe(starts[1].data);
  const snapshot = await a.client.rpc('classroom_replay', {
    p_schedule_id: schedule,
    p_after: 0,
  });
  expect(snapshot.error).toBeNull();
  expect((snapshot.data as { events: unknown[] }).events).toHaveLength(2);
  expect(
    (
      await a.client.rpc('classroom_lifecycle', {
        p_schedule_id: a.reservations[1].id,
        p_request_id: randomUUID(),
        p_action: 'start',
      })
    ).error?.code,
  ).toBe('P5001');
  expect(
    (await b.client.rpc('begin_student_preview', { p_student_id: b.studentId }))
      .error,
  ).toBeNull();
  expect(
    (
      await b.client.rpc('classroom_replay', {
        p_schedule_id: schedule,
        p_after: 0,
      })
    ).error?.code,
  ).toBe('42501');
  expect(
    (
      await a.client.rpc('classroom_append', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_epoch: 0,
        p_command: { kind: 'write_math', payload: { text: 'spoofed' } },
      })
    ).error?.code,
  ).toBe('22023');
  expect(
    (
      await a.client
        .from('lesson_events')
        .insert({ lesson_id: starts[0].data!, event_type: 'forged' })
    ).error?.code,
  ).toBe('42501');
  expect((await a.client.from('questions').select('*')).data).toEqual([]);
  expect((await a.client.from('parent_profiles').select('*')).data).toEqual([]);
  expect(
    (
      await a.client.rpc('classroom_lifecycle', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_action: 'pause',
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await a.client.rpc('classroom_lifecycle', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_action: 'resume',
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await a.client.rpc('classroom_append', {
        p_schedule_id: schedule,
        p_request_id: randomUUID(),
        p_epoch: 0,
        p_command: { kind: 'clear_board', payload: { confirmed: true } },
      })
    ).error?.code,
  ).toBe('40001');
  expect((await a.client.rpc('end_student_preview')).error).toBeNull();
  const lesson = await a.client
    .from('lessons')
    .select('status')
    .eq('id', starts[0].data!)
    .single();
  expect(lesson.data?.status).toBe('abandoned');
  await enter(page, a);
  const response = await page.reload();
  expect(response!.headers()['cache-control']).toContain('no-store');
  await expect(page.getByTestId('lesson-state')).toHaveText('abandoned');
  await page.goto(`/preview/${a.studentId}/classroom/${b.reservations[0].id}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});
