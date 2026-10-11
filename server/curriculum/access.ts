import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSessionClient } from '@/server/supabase-session';

export const requireAcademicReader = cache(async () => {
  const client = await createSessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect('/auth/sign-in');
  if (!user.email_confirmed_at) redirect('/auth/verify-email');
  const { data: identity, error: roleError } = await client
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (roleError) throw new Error('Unable to verify academic access');
  if (!identity || !['PARENT', 'ADMIN'].includes(identity.role))
    redirect('/auth/access-denied');
  return { client, user, role: identity.role };
});
export async function requireAcademicAdmin() {
  const context = await requireAcademicReader();
  if (context.role !== 'ADMIN')
    throw new Error('Academic administrator required');
  return context;
}
