import 'server-only';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireParent } from './parent';
import { requirePreview } from '@/server/application/preview';
export async function getStudent(
  id: string,
  mode: 'parent' | 'preview' = 'parent',
) {
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } =
    mode === 'preview' ? await requirePreview(id) : await requireParent();
  const { data, error } = await client
    .from('student_profiles')
    .select('id,display_name,grade,learning_goals')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('Student profile could not be loaded.');
  if (!data) notFound();
  return { client, student: data };
}
