import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createSessionClient } from '@/server/supabase-session';
export const requirePreview = cache(async (studentId: string) => {
  const client = await createSessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect('/auth/sign-in');
  if (!user.email_confirmed_at) redirect('/auth/verify-email');
  const preview = await client.rpc('active_preview_student');
  if (preview.error) throw new Error('Preview access could not be verified.');
  if (preview.data !== studentId) notFound();
  // The database scope still requires the relationship for all student reads.
  return { client };
});
