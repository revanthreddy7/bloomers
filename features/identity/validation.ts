import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.email().trim().max(254),
  password: z.string().min(12, 'Use at least 12 characters.').max(128),
});
export const emailSchema = z.object({ email: z.email().trim().max(254) });
export const passwordSchema = z.object({
  password: z.string().min(12, 'Use at least 12 characters.').max(128),
});
export const studentSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter a display name.').max(80),
  grade: z.coerce.number().int().min(1).max(12),
  learningGoals: z.string().trim().max(500).default(''),
});
export const consentSchema = z.object({
  requestId: z.uuid(),
  studentId: z.uuid(),
  consentType: z.enum([
    'ai_tutoring',
    'microphone',
    'camera_analysis',
    'uploads',
    'recording',
  ]),
  policyVersion: z.string().min(1).max(80),
  granted: z.enum(['true', 'false']).transform((value) => value === 'true'),
});
export function safeNext(value: string | null): string {
  if (!value || !/^\/parent(?:\/[a-zA-Z0-9/-]*)?$/.test(value))
    return '/parent';
  return value;
}
export type ActionState = { error?: string; message?: string };
export const capabilityLabels: Record<string, string> = {
  ai_tutoring: 'AI tutoring',
  microphone: 'Microphone',
  camera_analysis: 'Camera and image analysis',
  uploads: 'Work uploads',
  recording: 'Optional recording',
};
