import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
const versionId = '00000000-0000-0000-0000-000000000101';
function localAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local fixtures only');
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
async function family() {
  const email = `planning-${randomUUID()}@example.test`,
    password = `Local-${randomUUID()}!`;
  expect(
    (
      await localAdmin().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
    ).error,
  ).toBeNull();
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (await client.auth.signInWithPassword({ email, password })).error,
  ).toBeNull();
  expect((await client.rpc('provision_parent')).error).toBeNull();
  const { data: studentId, error } = await client.rpc('create_parent_student', {
    p_request_id: randomUUID(),
    p_display_name: 'Roadmap learner',
    p_grade: 8,
  });
  expect(error).toBeNull();
  return { email, password, client, studentId };
}
function preferences() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  return {
    schemaVersion: 1,
    timezone: 'America/New_York',
    lessonDurationMinutes: 30,
    weeklyFrequency: 2,
    slots: [
      { weekday: 1, time: '16:00' },
      { weekday: 3, time: '16:00' },
    ],
    earliestDate: date.toISOString().slice(0, 10),
  };
}
test('parent enrolls from a student profile, receives persisted roadmap, refreshes and cannot access another family', async ({
  page,
}) => {
  const a = await family(),
    b = await family(),
    p = preferences();
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(a.email);
  await page.getByLabel('Password', { exact: true }).fill(a.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await page.goto(`/parent/students/${a.studentId}`);
  await expect(page.getByText('No courses enrolled yet.')).toBeVisible();
  await page
    .getByRole('link', { name: 'Enroll in a course', exact: true })
    .click();
  await page.getByLabel('Published course').selectOption(versionId);
  await page.getByLabel('Timezone', { exact: true }).fill(p.timezone);
  await page.getByLabel('Monday', { exact: true }).check();
  await page.getByLabel('Wednesday', { exact: true }).check();
  await page.getByLabel('Preferred local lesson time').fill('16:00');
  await page.getByLabel('Earliest starting date').fill(p.earliestDate);
  await page
    .getByRole('button', { name: 'Confirm enrollment', exact: true })
    .click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]+$/);
  const url = page.url();
  const enrollmentId = url.split('/').at(-1)!;
  await expect(
    page.getByRole('heading', { name: 'Roadmap learner’s learning roadmap' }),
  ).toBeVisible();
  await expect(page.getByText('Not yet assessed', { exact: true })).toHaveCount(
    5,
  );
  await expect(
    page.getByRole('heading', { name: /^Lesson [1-4]$/ }),
  ).toHaveCount(4);
  await expect(
    page.getByText('Curriculum version 1 · Plan version 1'),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(
    page.getByRole('heading', { name: 'Projected lesson sequence' }),
  ).toBeVisible();
  const retry = await a.client.rpc('enroll_parent_student', {
    p_request_id: randomUUID(),
    p_student_id: a.studentId,
    p_version_id: versionId,
    p_preferences: p,
  });
  expect(retry.error).toBeNull();
  expect(retry.data).toBe(enrollmentId);
  const skills = await a.client
    .from('student_skills')
    .select('assessment_state,evidence_count,mastery_score')
    .eq('student_id', a.studentId);
  expect(skills.data).toHaveLength(5);
  expect(
    skills.data?.every(
      (s) =>
        s.assessment_state === 'unassessed' &&
        s.evidence_count === 0 &&
        s.mastery_score === 0,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/parent/students/${b.studentId}/courses/${enrollmentId}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  expect(
    (
      await b.client
        .from('course_plans')
        .select('id')
        .eq('student_course_id', enrollmentId)
    ).data,
  ).toEqual([]);
  expect(
    (
      await b.client.rpc('enroll_parent_student', {
        p_request_id: randomUUID(),
        p_student_id: a.studentId,
        p_version_id: versionId,
        p_preferences: p,
      })
    ).error?.code,
  ).toBe('42501');
  await page.goto(`/parent/students/${a.studentId}`);
  await page
    .getByRole('link', { name: 'View course roadmap', exact: true })
    .click();
  await expect(page).toHaveURL(url);
});
test('concurrent enrollment is atomic and idempotent, while schedule conflicts leave no partial course', async () => {
  const { client, studentId } = await family(),
    p = preferences();
  const args = {
    p_request_id: randomUUID(),
    p_student_id: studentId,
    p_version_id: versionId,
    p_preferences: p,
  };
  const results = await Promise.all([
    client.rpc('enroll_parent_student', args),
    client.rpc('enroll_parent_student', {
      ...args,
      p_request_id: randomUUID(),
    }),
  ]);
  expect(results.every((result) => !result.error)).toBe(true);
  expect(results[0].data).toBe(results[1].data);
  const courses = await client
    .from('student_courses')
    .select('id')
    .eq('student_id', studentId);
  expect(courses.data).toHaveLength(1);
  const plans = await client
    .from('course_plans')
    .select('id')
    .eq('student_course_id', results[0].data);
  expect(plans.data).toHaveLength(1);
  const schedules = await client
    .from('lesson_schedules')
    .select('starts_at,ends_at')
    .eq('course_plan_id', plans.data![0].id);
  expect(schedules.data).toHaveLength(4);
  expect(
    (
      await client
        .from('course_plan_items')
        .select('id')
        .eq('course_plan_id', plans.data![0].id)
    ).data,
  ).toHaveLength(7);
  expect(
    (
      await client
        .from('student_skills')
        .select('skill_id')
        .eq('student_id', studentId)
    ).data,
  ).toHaveLength(5);
  const blocked = await client.rpc('create_parent_student', {
    p_request_id: randomUUID(),
    p_display_name: 'Blocked learner',
    p_grade: 8,
  });
  expect(blocked.error).toBeNull();
  expect(
    (
      await localAdmin().from('lesson_schedules').insert({
        student_id: blocked.data,
        starts_at: schedules.data![0].starts_at,
        ends_at: schedules.data![0].ends_at,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await client.rpc('enroll_parent_student', {
        ...args,
        p_student_id: blocked.data,
        p_request_id: randomUUID(),
      })
    ).error?.code,
  ).toBe('23P01');
  expect(
    (
      await client
        .from('student_courses')
        .select('id')
        .eq('student_id', blocked.data)
    ).data,
  ).toEqual([]);
  expect(
    (
      await client
        .from('student_skills')
        .select('skill_id')
        .eq('student_id', blocked.data)
    ).data,
  ).toEqual([]);
  expect(
    (
      await client
        .from('availability_preferences')
        .select('id')
        .eq('student_id', blocked.data)
    ).data,
  ).toEqual([]);
  expect(
    (
      await client
        .from('student_skills')
        .update({ mastery_score: 1 })
        .eq('student_id', studentId)
    ).error?.code,
  ).toBe('42501');
});
