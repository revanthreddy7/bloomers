'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { academicIdSchema } from '@/features/curriculum/schema';
import { validatePreferences } from '@/features/planning/schema';
import { initialPlan } from '@/features/planning/planner';
import { getStudent } from '@/server/identity/students';
import type { ActionState } from '@/features/identity/validation';
import type { Json } from '@/types/database';
import { measureEnrollment } from '@/server/observability/enrollment';
export async function enrollStudent(
  studentId: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  let requestId: string,
    versionId: string,
    preferences: ReturnType<typeof validatePreferences>;
  try {
    academicIdSchema.parse(studentId);
    requestId = z.uuid().parse(form.get('requestId'));
    versionId = academicIdSchema.parse(form.get('versionId'));
    const weekdays = form
      .getAll('weekdays')
      .map((value) =>
        Number(z.enum(['0', '1', '2', '3', '4', '5', '6']).parse(value)),
      );
    preferences = validatePreferences({
      schemaVersion: 1,
      timezone: form.get('timezone'),
      lessonDurationMinutes: Number(form.get('duration')),
      weeklyFrequency: Number(form.get('frequency')),
      earliestDate: form.get('earliestDate'),
      slots: weekdays.map((weekday) => ({ weekday, time: form.get('time') })),
    });
  } catch {
    return {
      error:
        'Choose a published course, valid timezone, date, duration, and exactly one weekday per weekly lesson.',
    };
  }
  const { client } = await measureEnrollment('student_authorization', () =>
    getStudent(studentId),
  );
  const publication = await measureEnrollment('publication_read', () =>
    client
      .from('curriculum_versions')
      .select('document,status')
      .eq('id', versionId)
      .eq('status', 'published')
      .maybeSingle(),
  );
  if (publication.error || !publication.data)
    return { error: 'Select an available published course.' };
  // Calendar projection runs after the database's idempotency check, so old retries
  // still resolve their original roadmap even when their starting date has passed.
  try {
    initialPlan(publication.data.document, preferences.lessonDurationMinutes);
  } catch {
    return {
      error: 'This course cannot be planned with the selected lesson duration.',
    };
  }
  const { data, error } = await measureEnrollment(
    'enrollment_transaction',
    () =>
      client.rpc('enroll_parent_student', {
        p_request_id: requestId,
        p_student_id: studentId,
        p_version_id: versionId,
        p_preferences: preferences as unknown as Json,
      }),
  );
  if (error) {
    const messages: Record<string, string> = {
      '42501': 'You cannot enroll this student.',
      '22023':
        'Check the course and preferences. For a new enrollment, choose a starting date from today through the next year.',
      '23P01':
        'A projected lesson overlaps an existing lesson. Choose different weekdays or times.',
      P3001:
        'A selected lesson time is ambiguous or does not exist during a daylight-saving transition. Choose another time.',
      P3003:
        'This student is already enrolled, or this request was already used. The existing version and preferences remain unchanged.',
      P3004:
        'This existing enrollment needs reviewed initialization before a roadmap can be shown.',
      P0001: 'Please wait before enrolling again.',
    };
    return {
      error:
        messages[error.code] ??
        'Enrollment could not be created. Check your preferences and try again.',
    };
  }
  revalidatePath(`/parent/students/${studentId}`);
  redirect(`/parent/students/${studentId}/courses/${data}`);
}
