import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSessionClient } from '@/server/supabase-session';
import { transientAuthFailure } from '@/features/identity/auth-failure';

export const requireParent = cache(async () => {
  const client = await createSessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (transientAuthFailure(error))
    throw new Error(
      'Authentication is temporarily unavailable. Please try again.',
    );
  if (error || !user) redirect('/auth/sign-in');
  if (!user.email_confirmed_at) redirect('/auth/verify-email');
  const preview = await client.rpc('active_preview_student');
  if (preview.error) {
    if (preview.error.code === '42501') redirect('/auth/access-denied');
    throw new Error('Your account could not be prepared. Please try again.');
  }
  if (preview.data) redirect(`/preview/${preview.data}`);
  const { error: provisioningError } = await client.rpc('provision_parent');
  if (provisioningError) {
    if (provisioningError.code === '42501') redirect('/auth/access-denied');
    throw new Error('Your account could not be prepared. Please try again.');
  }
  return { client, user };
});
