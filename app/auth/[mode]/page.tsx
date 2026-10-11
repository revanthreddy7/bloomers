import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AuthForm, ResetForm } from '@/components/identity/forms';
import { createSessionClient } from '@/server/supabase-session';
import { signOut } from '@/server/identity/actions';
import { safeNext } from '@/features/identity/validation';
export const dynamic = 'force-dynamic';
const screens: Record<string, { title: string; description: string }> = {
  'sign-up': {
    title: 'A little support. A world of possibility.',
    description:
      'Create your parent account to manage student profiles. Lessons and Maya sessions are coming in a later phase.',
  },
  'sign-in': {
    title: 'Welcome back.',
    description: 'Your family’s learning journey starts here.',
  },
  'verify-email': {
    title: 'Check your inbox.',
    description:
      'Open the verification email to finish setting up your parent account. Your address must be verified before student profiles can be created.',
  },
  'forgot-password': {
    title: 'Let’s get you back in.',
    description:
      'Enter your email address to request a password recovery link.',
  },
  'reset-password': {
    title: 'A fresh start.',
    description:
      'Choose a new, unique password. Other sessions will be signed out.',
  },
  'link-expired': {
    title: 'This link could not be used.',
    description:
      'It may have expired or already been used. Request a fresh email to continue.',
  },
  'access-denied': {
    title: 'Parent access required.',
    description:
      'This account is not provisioned as a parent account. Sign out and use your parent account.',
  },
};
export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ next?: string; password?: string }>;
}) {
  const { mode } = await params;
  const query = await searchParams;
  const screen = screens[mode];
  if (!screen) notFound();
  const client = await createSessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user?.email_confirmed_at && ['sign-in', 'sign-up'].includes(mode)) {
    const { data: admin } = await client.rpc('is_academic_admin');
    redirect(admin === true ? '/curriculum' : '/parent');
  }
  const passwordSession =
    mode !== 'reset-password' || !!user?.email_confirmed_at;
  return (
    <main className="identity-shell auth-shell">
      <Link href="/" className="brand">
        ✳ BLOOMERS
      </Link>
      <div className="auth-grid">
        <section>
          <div className="eyebrow">FOR PARENTS</div>
          <h1>{screen.title}</h1>
          <p>{screen.description}</p>
          <div className="quiet-note">
            One learner. A thoughtful foundation. Room to grow.
          </div>
        </section>
        <section className="panel" aria-label="Account form">
          {mode === 'sign-up' && (
            <>
              <h2>Create an account</h2>
              <AuthForm mode="sign-up" />
              <p className="small">
                Already have an account?{' '}
                <Link href="/auth/sign-in">Sign in</Link>
              </p>
            </>
          )}
          {mode === 'sign-in' && (
            <>
              <h2>Sign in</h2>
              {query.password === 'updated' && (
                <p className="feedback">
                  Your password was updated. Sign in again.
                </p>
              )}
              <AuthForm mode="sign-in" next={safeNext(query.next ?? null)} />
              <p className="small">
                New to Bloomers?{' '}
                <Link href="/auth/sign-up">Create a parent account</Link>
              </p>
            </>
          )}
          {mode === 'verify-email' && (
            <>
              <h2>Need another email?</h2>
              <AuthForm mode="resend" />
              <Link href="/auth/sign-in">Return to sign in</Link>
            </>
          )}
          {mode === 'forgot-password' && (
            <>
              <h2>Password recovery</h2>
              <AuthForm mode="forgot-password" />
              <Link href="/auth/sign-in">Return to sign in</Link>
            </>
          )}
          {mode === 'reset-password' &&
            (passwordSession ? (
              <ResetForm />
            ) : (
              <>
                <p role="alert">Your session is unavailable or expired.</p>
                <Link href="/auth/forgot-password">
                  Request a new recovery link
                </Link>
              </>
            ))}
          {mode === 'link-expired' && (
            <>
              <Link className="button" href="/auth/verify-email">
                Resend verification
              </Link>
              <Link href="/auth/forgot-password">
                Request password recovery
              </Link>
            </>
          )}
          {mode === 'access-denied' && (
            <form action={signOut}>
              <button>Sign out</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
