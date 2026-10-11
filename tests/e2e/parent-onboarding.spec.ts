import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const mailOrigin = 'http://127.0.0.1:54324';
async function emailLink(
  request: APIRequestContext,
  email: string,
  subject: string,
) {
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mailOrigin}/api/v1/messages`);
        const body = await response.json();
        const found = body.messages?.find(
          (message: {
            ID: string;
            Subject: string;
            To: { Address: string }[];
          }) =>
            message.Subject.includes(subject) &&
            message.To.some((recipient) => recipient.Address === email),
        );
        messageId = found?.ID;
        return !!messageId;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  const response = await request.get(
    `${mailOrigin}/api/v1/message/${messageId}`,
  );
  const message = await response.json();
  const match = message.HTML.match(/href="([^"]*\/auth\/confirm[^\"]*)"/);
  if (!match)
    throw new Error(
      'Verification/recovery link missing from local email template',
    );
  const link = match[1].replaceAll('&amp;', '&');
  if (new URL(link).origin !== 'http://localhost:3000')
    throw new Error('Unexpected local email origin');
  return link;
}
function localAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Browser integration tests require local Supabase');
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test('parent signup, email verification, student management, consent withdrawal, persistence, sign-out', async ({
  page,
  request,
  browser,
}) => {
  const email = `onboarding-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  await page.goto('/parent');
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.goto('/auth/sign-up');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create parent account' }).click();
  await expect(page).toHaveURL(/\/auth\/verify-email$/);
  // Verification is required; signup alone does not provision an app profile.
  const admin = localAdmin();
  const { data: identities } = await admin.auth.admin.listUsers();
  const identity = identities.users.find((user) => user.email === email)!;
  const before = await admin
    .from('parent_profiles')
    .select('user_id')
    .eq('user_id', identity.id);
  expect(before.data).toHaveLength(0);
  const link = await emailLink(request, email, 'Verify');
  await page.goto(link);
  await expect(page).toHaveURL(/\/parent$/);
  await page.getByRole('link', { name: 'Add student', exact: true }).click();
  await page.getByLabel('Student display name').fill('Alex');
  await page.getByLabel('Grade', { exact: true }).selectOption('8');
  await page
    .getByLabel('Learning goals')
    .fill('Build confidence with fractions.');
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Alex', exact: true }),
  ).toBeVisible();
  const studentPath = new URL(page.url()).pathname;
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('link', { name: 'Edit profile' }).click();
  await page.getByLabel('Student display name').fill('Alex updated');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Alex updated', exact: true }),
  ).toBeVisible();
  const microphone = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Microphone', exact: true }),
  });
  await expect(
    microphone.getByRole('button', { name: 'Grant consent' }),
  ).toBeDisabled();
  await microphone.getByRole('button', { name: 'Record withdrawal' }).click();
  await expect(
    page.getByText('Microphone: Withdrawn', { exact: true }),
  ).toBeVisible();
  // Simulate an expired stored session; a valid refresh token must renew it.
  const cookies = await page.context().cookies();
  const authCookies = cookies
    .filter((cookie) => /sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  expect(authCookies.length).toBeGreaterThan(0);
  const encoded = authCookies.map((cookie) => cookie.value).join('');
  const session = JSON.parse(
    Buffer.from(encoded.slice('base64-'.length), 'base64url').toString('utf8'),
  );
  session.expires_at = 1;
  const expired =
    'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  let offset = 0;
  await page.context().addCookies(
    authCookies.map((cookie, index) => {
      const width =
        index === authCookies.length - 1
          ? expired.length - offset
          : cookie.value.length;
      const value = expired.slice(offset, offset + width);
      offset += width;
      return { ...cookie, value };
    }),
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Alex updated', exact: true }),
  ).toBeVisible();
  // The email token is one-time and cannot revive a session.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(link);
  await expect(otherPage).toHaveURL(/\/auth\/link-expired$/);
  await otherPage.goto(`http://localhost:3000${studentPath}`);
  await expect(otherPage).toHaveURL(/\/auth\/sign-in$/);
  await other.close();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.goto(studentPath);
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await expect(
    page.getByRole('heading', { name: 'Alex updated' }),
  ).toBeVisible();
});

test('password recovery uses email token, rejects replay, signs out and accepts only the new password', async ({
  page,
  request,
}) => {
  const email = `recovery-${randomUUID()}@example.test`;
  const oldPassword = `Old-${randomUUID()}!`,
    newPassword = `New-${randomUUID()}!`;
  const { error } = await localAdmin().auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true,
  });
  expect(error).toBeNull();
  await page.goto('/auth/reset-password');
  await expect(
    page.getByText('Your session is unavailable or expired.'),
  ).toBeVisible();
  await page.goto('/auth/forgot-password');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send recovery email' }).click();
  await expect(page.getByText(/If this address can receive/)).toBeVisible();
  const link = await emailLink(request, email, 'Reset');
  await page.goto(link);
  await expect(page).toHaveURL(/\/auth\/reset-password$/);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?password=updated$/);
  await page.goto(link);
  await expect(page).toHaveURL(/\/auth\/link-expired$/);
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(oldPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Unable to sign in' }),
  ).toContainText('Unable to sign in');
  await page.getByLabel('Password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
});

test('concurrent API retries create one relationship and cross-parent mutations are denied', async () => {
  const admin = localAdmin();
  const password = `Local-${randomUUID()}!`;
  const email = `concurrency-${randomUUID()}@example.test`;
  const identity = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(identity.error).toBeNull();
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (await client.auth.signInWithPassword({ email, password })).error,
  ).toBeNull();
  expect((await client.rpc('provision_parent')).error).toBeNull();
  const args = {
    p_request_id: randomUUID(),
    p_display_name: 'Concurrent learner',
    p_grade: 8,
    p_learning_goals: null,
  };
  const results = await Promise.all([
    client.rpc('create_parent_student', args),
    client.rpc('create_parent_student', args),
  ]);
  expect(results.every((result) => !result.error)).toBe(true);
  expect(results[0].data).toBe(results[1].data);
  const relationships = await admin
    .from('parent_student_relationships')
    .select('student_id')
    .eq('parent_id', identity.data.user!.id);
  expect(relationships.data).toHaveLength(1);
  const foreignEmail = `foreign-${randomUUID()}@example.test`;
  await admin.auth.admin.createUser({
    email: foreignEmail,
    password,
    email_confirm: true,
  });
  const foreign = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await foreign.auth.signInWithPassword({ email: foreignEmail, password });
  await foreign.rpc('provision_parent');
  expect(
    (
      await foreign
        .from('student_profiles')
        .select('id')
        .eq('id', results[0].data)
    ).data,
  ).toEqual([]);
  expect(
    (
      await foreign.rpc('update_parent_student', {
        p_student_id: results[0].data,
        p_display_name: 'Forged',
        p_grade: 8,
        p_learning_goals: null,
      })
    ).error?.code,
  ).toBe('42501');
});
