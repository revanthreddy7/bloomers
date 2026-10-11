import { z } from 'zod';
const time = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);
export const schedulePreferencesSchema = z.strictObject({
  schemaVersion: z.literal(1),
  timezone: z
    .string()
    .min(1)
    .max(100)
    .regex(/^(UTC|[A-Za-z_+-]+\/[A-Za-z0-9_+\/-]+)$/),
  lessonDurationMinutes: z.number().int().min(20).max(90),
  weeklyFrequency: z.number().int().min(1).max(7),
  slots: z
    .array(z.strictObject({ weekday: z.number().int().min(0).max(6), time }))
    .min(1)
    .max(7),
  earliestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type SchedulePreferences = z.infer<typeof schedulePreferencesSchema>;
export function validatePreferences(input: unknown): SchedulePreferences {
  const p = schedulePreferencesSchema.parse(input);
  new Intl.DateTimeFormat('en-US', { timeZone: p.timezone }).format(0);
  if (
    p.weeklyFrequency !== p.slots.length ||
    new Set(p.slots.map((s) => s.weekday)).size !== p.slots.length
  )
    throw new Error('Choose exactly one time for each selected weekday');
  const date = new Date(`${p.earliestDate}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== p.earliestDate
  )
    throw new Error('Invalid starting date');
  return { ...p, slots: [...p.slots].sort((a, b) => a.weekday - b.weekday) };
}
