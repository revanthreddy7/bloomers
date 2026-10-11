'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getStudent } from '@/server/identity/students';
import { createSessionClient } from '@/server/supabase-session';
export async function startPreview(studentId: string) {
  z.uuid().parse(studentId);
  const { client } = await getStudent(studentId);
  const { data, error } = await client.rpc('begin_student_preview', {
    p_student_id: studentId,
  });
  if (error || data !== studentId)
    throw new Error('Student preview could not be opened.');
  revalidatePath('/parent', 'layout');
  redirect(`/preview/${studentId}`);
}
export async function endPreview() {
  const client = await createSessionClient();
  const { data, error } = await client.rpc('end_student_preview');
  if (error)
    throw new Error(
      'Return to parent mode did not complete. Please try again.',
    );
  revalidatePath('/parent', 'layout');
  revalidatePath('/preview', 'layout');
  redirect(data ? `/parent/learners/${data}/overview` : '/parent');
}
