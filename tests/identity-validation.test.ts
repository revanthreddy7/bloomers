import { expect, it } from 'vitest';
import {
  studentSchema,
  consentSchema,
  credentialsSchema,
  safeNext,
} from '@/features/identity/validation';
it.each([
  'https://evil.test',
  '//evil.test',
  '/\\evil.test',
  '/parent?next=https://evil.test',
  '/parent/../auth',
  '/parent%2f%2fevil.test',
  '/auth/reset-password',
  null,
])('rejects unsafe redirect %s', (value) =>
  expect(safeNext(value)).toBe('/parent'),
);
it('accepts a protected student destination', () =>
  expect(safeNext('/parent/students/123/edit')).toBe(
    '/parent/students/123/edit',
  ));
it('validates minimal student fields', () =>
  expect(
    studentSchema.parse({
      displayName: '  Alex  ',
      grade: '8',
      learningGoals: ' Fractions ',
    }),
  ).toEqual({ displayName: 'Alex', grade: 8, learningGoals: 'Fractions' }));
it.each([
  { displayName: ' ', grade: 8 },
  { displayName: 'Alex', grade: 0 },
  { displayName: 'Alex', grade: 13 },
  { displayName: 'Alex', grade: 8.5 },
  { displayName: 'Alex', grade: 8, learningGoals: 'x'.repeat(501) },
])('rejects invalid student details', (value) =>
  expect(studentSchema.safeParse(value).success).toBe(false),
);
it('strips attempted role and identity assignment', () =>
  expect(
    studentSchema.parse({
      displayName: 'Alex',
      grade: 8,
      role: 'ADMIN',
      user_id: 'impersonated',
    }),
  ).not.toHaveProperty('role'));
it('requires long signup passwords', () =>
  expect(
    credentialsSchema.safeParse({ email: 'a@example.test', password: 'short' })
      .success,
  ).toBe(false));
it('rejects forged consent categories and decisions', () =>
  expect(
    consentSchema.safeParse({
      requestId: crypto.randomUUID(),
      studentId: crypto.randomUUID(),
      consentType: 'everything',
      policyVersion: 'draft-v1',
      granted: 'yes',
    }).success,
  ).toBe(false));
