'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSessionClient } from '@/server/supabase-session';
import { requireParent } from './parent';
import {
  credentialsSchema,
  emailSchema,
  passwordSchema,
  studentSchema,
  consentSchema,
  safeNext,
  type ActionState,
} from '@/features/identity/validation';

// Next Server Actions check Origin against Host. APP_ORIGIN is configured by the
// operator and never derived from an untrusted Host/forwarded header.
async function appOrigin() {
  const configured = process.env.APP_ORIGIN;
  if (configured) return z.url().parse(configured).replace(/\/$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  throw new Error('APP_ORIGIN must be configured for authentication.');
}
export async function authenticate(
  mode: 'sign-up' | 'sign-in' | 'forgot-password' | 'resend',
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const raw = Object.fromEntries(form);
  const parsed = (
    mode === 'sign-in'
      ? z.object({
          email: z.email().trim().max(254),
          password: z.string().min(1).max(128),
        })
      : mode === 'sign-up'
        ? credentialsSchema
        : emailSchema
  ).safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  const client = await createSessionClient();
  const values = parsed.data;
  if (mode === 'forgot-password' || mode === 'resend') {
    const target = `${await appOrigin()}/auth/confirm`;
    if (mode === 'resend')
      await client.auth.resend({
        type: 'signup',
        email: values.email,
        options: { emailRedirectTo: target },
      });
    else
      await client.auth.resetPasswordForEmail(values.email, {
        redirectTo: target,
      });
    return {
      message:
        'If this address can receive the requested email, a link will arrive shortly. Check your inbox and spam folder.',
    };
  }
  if (!('password' in values)) return { error: 'Enter a password.' };
  const password = z.string().parse(values.password);
  if (mode === 'sign-up') {
    const { error } = await client.auth.signUp({
      email: values.email,
      password,
      options: { emailRedirectTo: `${await appOrigin()}/auth/confirm` },
    });
    if (error)
      return {
        error:
          'We could not complete signup. Check your details or wait before trying again.',
      };
    redirect('/auth/verify-email');
  }
  const { error } = await client.auth.signInWithPassword({
    email: values.email,
    password,
  });
  if (error)
    return {
      error:
        'Unable to sign in. Check your details, verify your email, or try again later.',
    };
  redirect(safeNext(form.get('next')?.toString() ?? null));
}
export async function signOut(): Promise<void> {
  const client = await createSessionClient();
  const { error } = await client.auth.signOut({ scope: 'global' });
  if (error) throw new Error('Sign-out did not complete. Please try again.');
  revalidatePath('/parent', 'layout');
  redirect('/auth/sign-in');
}
export async function resetPassword(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: 'Use a password with 12–128 characters.' };
  if (form.get('confirmPassword') !== parsed.data.password)
    return { error: 'The passwords do not match.' };
  const client = await createSessionClient();
  const {
    data: { user },
    error: sessionError,
  } = await client.auth.getUser();
  if (sessionError || !user || !user.email_confirmed_at)
    return { error: 'This session has expired. Request a new recovery email.' };
  const { error } = await client.auth.updateUser(parsed.data);
  if (error)
    return {
      error:
        'The password could not be changed. Request a fresh recovery link and try again.',
    };
  const { error: signOutError } = await client.auth.signOut({
    scope: 'global',
  });
  if (signOutError)
    return {
      error:
        'Your password changed, but session sign-out failed. Please try signing out again.',
    };
  redirect('/auth/sign-in?password=updated');
}
export async function saveStudent(
  studentId: string | null,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = studentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? 'Check student details.',
    };
  const { client } = await requireParent();
  const args = {
    p_display_name: parsed.data.displayName,
    p_grade: parsed.data.grade,
    p_learning_goals: parsed.data.learningGoals,
  };
  let selected = studentId;
  if (studentId) {
    if (!z.uuid().safeParse(studentId).success)
      return { error: 'Student unavailable.' };
    const { error } = await client.rpc('update_parent_student', {
      ...args,
      p_student_id: studentId,
    });
    if (error)
      return {
        error:
          error.code === 'P0001'
            ? 'Please wait before trying again.'
            : 'Student could not be updated. Check your access and try again.',
      };
  } else {
    const request = z.uuid().safeParse(form.get('requestId'));
    if (!request.success) return { error: 'Reload this form and try again.' };
    const { data, error } = await client.rpc('create_parent_student', {
      ...args,
      p_request_id: request.data,
    });
    if (error || !data)
      return {
        error:
          error?.code === 'P0001'
            ? 'Please wait before trying again.'
            : 'Student could not be added. Please try again.',
      };
    selected = data;
  }
  revalidatePath('/parent', 'layout');
  redirect(`/parent/students/${selected}`);
}
export async function saveConsent(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = consentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: 'Invalid consent decision. Reload this page.' };
  const { client } = await requireParent();
  const v = parsed.data;
  const { error } = await client.rpc('record_parent_consent', {
    p_request_id: v.requestId,
    p_student_id: v.studentId,
    p_consent_type: v.consentType,
    p_policy_version: v.policyVersion,
    p_granted: v.granted,
  });
  if (error)
    return {
      error:
        error.code === '22023'
          ? 'This policy is not approved for new grants. Withdrawals remain available.'
          : 'Decision could not be saved. Check your access or try again later.',
    };
  revalidatePath(`/parent/students/${v.studentId}`);
  return {
    message: v.granted
      ? 'Consent grant recorded.'
      : 'Consent withdrawal recorded.',
  };
}
