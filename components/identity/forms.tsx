'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  authenticate,
  resetPassword,
  saveStudent,
  saveConsent,
} from '@/server/identity/actions';
import type { ActionState } from '@/features/identity/validation';
const initial: ActionState = {};
function Feedback({ state }: { state: ActionState }) {
  return (
    <div aria-live="polite">
      {state.error && (
        <p className="feedback error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && <p className="feedback">{state.message}</p>}
    </div>
  );
}
export function AuthForm({
  mode,
  next = '/parent',
}: {
  mode: 'sign-up' | 'sign-in' | 'forgot-password' | 'resend';
  next?: string;
}) {
  const [state, action, pending] = useActionState(
    authenticate.bind(null, mode),
    initial,
  );
  const password = mode === 'sign-up' || mode === 'sign-in';
  const [email, setEmail] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  return (
    <form action={action} className="form-stack">
      <Feedback state={state} />
      <label>
        Email address
        <input
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      {password && (
        <label>
          Password
          <input
            name="password"
            value={passwordValue}
            onChange={(event) => setPasswordValue(event.target.value)}
            aria-label="Password"
            aria-describedby={mode === 'sign-up' ? 'password-help' : undefined}
            type="password"
            autoComplete={
              mode === 'sign-up' ? 'new-password' : 'current-password'
            }
            minLength={mode === 'sign-up' ? 12 : 1}
            maxLength={128}
            required
          />
          {mode === 'sign-up' && (
            <span className="field-help" id="password-help">
              At least 12 characters. Use a unique password.
            </span>
          )}
        </label>
      )}
      <input type="hidden" name="next" value={next} />
      <button disabled={pending}>
        {pending
          ? 'Please wait…'
          : mode === 'sign-up'
            ? 'Create parent account'
            : mode === 'sign-in'
              ? 'Sign in'
              : mode === 'resend'
                ? 'Resend verification email'
                : 'Send recovery email'}
      </button>
      {mode === 'sign-in' && (
        <Link href="/auth/forgot-password">Forgot your password?</Link>
      )}
    </form>
  );
}
export function ResetForm() {
  const [state, action, pending] = useActionState(resetPassword, initial);
  return (
    <form action={action} className="form-stack">
      <Feedback state={state} />
      <label>
        New password
        <input
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </label>
      <button disabled={pending}>
        {pending ? 'Saving…' : 'Save new password'}
      </button>
      <Link href="/auth/forgot-password">Request another recovery email</Link>
    </form>
  );
}
export function StudentForm({
  student,
  requestId,
}: {
  student?: {
    id: string;
    display_name: string;
    grade: number | null;
    learning_goals: string | null;
  };
  requestId?: string;
}) {
  const [state, action, pending] = useActionState(
    saveStudent.bind(null, student?.id ?? null),
    initial,
  );
  const [name, setName] = useState(student?.display_name ?? '');
  const [grade, setGrade] = useState(student?.grade ?? 8);
  const [goals, setGoals] = useState(student?.learning_goals ?? '');
  return (
    <form action={action} className="form-stack">
      <Feedback state={state} />
      {!student && <input type="hidden" name="requestId" value={requestId} />}
      <label>
        Student display name
        <input
          name="displayName"
          aria-label="Student display name"
          aria-describedby="student-name-help"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
          autoComplete="off"
        />
        <span className="field-help" id="student-name-help">
          A first name or nickname is enough.
        </span>
      </label>
      <label>
        Grade
        <select
          name="grade"
          aria-label="Grade"
          value={grade}
          onChange={(event) => setGrade(Number(event.target.value))}
          required
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Grade {i + 1}
            </option>
          ))}
        </select>
      </label>
      <label>
        Learning goals <span className="field-help">(optional)</span>
        <textarea
          name="learningGoals"
          aria-label="Learning goals"
          value={goals}
          onChange={(event) => setGoals(event.target.value)}
          maxLength={500}
          rows={4}
        />
        <span className="field-help">
          Keep this about learning. Avoid medical details or other sensitive
          information.
        </span>
      </label>
      <button disabled={pending}>
        {pending ? 'Saving…' : student ? 'Save changes' : 'Add student'}
      </button>
      <Link href={student ? `/parent/students/${student.id}` : '/parent'}>
        Cancel
      </Link>
    </form>
  );
}
export function ConsentForm({
  studentId,
  type,
  version,
  approved,
  granted,
  requestId,
}: {
  studentId: string;
  type: string;
  version: string;
  approved: boolean;
  granted: boolean;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(saveConsent, initial);
  return (
    <form action={action} className="consent-form">
      <Feedback state={state} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="consentType" value={type} />
      <input type="hidden" name="policyVersion" value={version} />
      <button
        name="granted"
        value="false"
        className="secondary"
        disabled={pending}
      >
        {pending ? 'Saving…' : 'Record withdrawal'}
      </button>
      {!granted && (
        <button name="granted" value="true" disabled={pending || !approved}>
          Grant consent
        </button>
      )}
    </form>
  );
}
