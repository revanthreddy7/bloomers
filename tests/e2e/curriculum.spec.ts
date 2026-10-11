import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import sample from '../../supabase/fixtures/grade-8.json';
const courseId = '00000000-0000-0000-0000-000000000002';
function localAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local fixtures only');
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
async function identity(role: 'PARENT' | 'ADMIN' | 'STUDENT') {
  const admin = localAdmin(),
    email = `curriculum-${randomUUID()}@example.test`,
    password = `Local-${randomUUID()}!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'ADMIN' },
  });
  expect(error).toBeNull();
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (await client.auth.signInWithPassword({ email, password })).error,
  ).toBeNull();
  if (role === 'PARENT')
    expect((await client.rpc('provision_parent')).error).toBeNull();
  else
    expect(
      (await admin.from('users').insert({ id: data.user!.id, role })).error,
    ).toBeNull();
  return { client, email, password };
}
test('parent explores published content, hidden drafts stay unavailable, mobile layout fits', async ({
  page,
}) => {
  const { email, password, client } = await identity('PARENT');
  await page.goto('/curriculum');
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await page.getByRole('link', { name: 'Curriculum', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Curriculum Explorer' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Grade 8 Mathematics', exact: true })
    .click();
  await expect(
    page.getByText('Published version 1', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '1. Linear Equations' }),
  ).toBeVisible();
  await expect(
    page.getByText('Two-step equations', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Prerequisites: Integer arithmetic, Fraction arithmetic, One-step equations',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Whiteboard demonstrations' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect((await client.from('questions').select('answer')).data).toEqual([]);
  expect(
    (
      await client.rpc('save_curriculum_draft', {
        p_course_id: courseId,
        p_expected_revision: 0,
        p_document: sample,
      })
    ).error?.code,
  ).toBe('42501');
  await page.goto(`/curriculum/${courseId}?version=${randomUUID()}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});
test('administrator access is canonical and concurrent revisions cannot combine into a cycle', async ({
  page,
}) => {
  const { client, email, password } = await identity('ADMIN');
  const { data: versionId, error } = await client.rpc('save_curriculum_draft', {
    p_course_id: courseId,
    p_expected_revision: 0,
    p_document: sample,
  });
  expect(error).toBeNull();
  const a = structuredClone(sample),
    b = structuredClone(sample);
  a.prerequisites.push({
    skillId: sample.units[0].topics[0].skills[0].id,
    prerequisiteId: sample.units[0].topics[0].skills[1].id,
  });
  b.prerequisites.push({
    skillId: sample.units[0].topics[0].skills[1].id,
    prerequisiteId: sample.units[0].topics[0].skills[0].id,
  });
  const results = await Promise.all(
    [a, b].map((document) =>
      client.rpc('save_curriculum_draft', {
        p_course_id: courseId,
        p_version_id: versionId,
        p_expected_revision: 1,
        p_document: document,
      }),
    ),
  );
  expect(results.filter((result) => !result.error)).toHaveLength(1);
  expect(
    results.filter((result) => result.error?.code === '40001'),
  ).toHaveLength(1);
  const saved = await client
    .from('curriculum_versions')
    .select('revision,document')
    .eq('id', versionId)
    .single();
  expect(saved.data?.revision).toBe(2);
  expect(saved.data?.document.prerequisites).toHaveLength(6);
  const invalid = structuredClone(sample);
  invalid.prerequisites.push(
    ...a.prerequisites.slice(-1),
    ...b.prerequisites.slice(-1),
  );
  expect(
    (
      await client.rpc('save_curriculum_draft', {
        p_course_id: courseId,
        p_version_id: versionId,
        p_expected_revision: 2,
        p_document: invalid,
      })
    ).error?.code,
  ).toBe('22023');
  const parent = await identity('PARENT');
  expect(
    (
      await parent.client
        .from('curriculum_versions')
        .select('id')
        .eq('id', versionId)
    ).data,
  ).toEqual([]);
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/curriculum$/);
  await expect(
    page.getByRole('heading', { name: 'Curriculum Explorer' }),
  ).toBeVisible();
  await page.goto(`/curriculum/${courseId}?version=${versionId}`);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});
