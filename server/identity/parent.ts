import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSessionClient } from '@/server/supabase-session';

export const requireParent = cache(async () => {
  const client = await createSessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect('/auth/sign-in');
  if (!user.email_confirmed_at) redirect('/auth/verify-email');
  const { error: provisioningError } = await client.rpc('provision_parent');
  if (provisioningError) {
    if (provisioningError.code === '42501') redirect('/auth/access-denied');
    throw new Error('Your account could not be prepared. Please try again.');
  }
  return { client, user };
});
