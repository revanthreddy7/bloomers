import { expect, it } from 'vitest';
import sample from '@/supabase/fixtures/grade-8.json';
import { validateStructure } from '@/features/curriculum/engine';
import {
  academicModel,
  progressModel,
  homeworkModel,
  attendanceModel,
  weeklyReservations,
  weekWindow,
  formatInstant,
  localDate,
  upcomingReservations,
  type Reservation,
} from '@/features/application/models';
const document = validateStructure(sample);
const id = sample.units[0].topics[0].skills[0].id;
const state = {
  skill_id: id,
  assessment_state: 'evidenced',
  evidence_count: 2,
  last_evidence_id: 'e1',
  mastery_score: 1,
  confidence: 1,
};
const reservation = (starts_at: string, status = 'scheduled'): Reservation => ({
  id: starts_at,
  starts_at,
  ends_at: new Date(Date.parse(starts_at) + 1800000).toISOString(),
  status,
  timezone: 'America/New_York',
  lesson_position: 1,
  course_plan_id: 'plan',
});
it('builds the pinned academic hierarchy and prerequisite names', () => {
  const academic = academicModel(document);
  expect(academic[0].topics[0].skills).toHaveLength(5);
  expect(academic[0].topics[0].skills.at(-1)!.prerequisites).toContain(
    'One-step equations',
  );
});
it('uninitialized and zero-evidence skills remain unassessed', () => {
  expect(
    progressModel(document, [], []).every(
      (s) => s.status === 'Not yet assessed',
    ),
  ).toBe(true);
  expect(
    progressModel(
      document,
      [{ ...state, evidence_count: 0 }],
      [{ id: 'e1', skill_id: id }],
    )[0].status,
  ).toBe('Not yet assessed');
});
it('does not infer mastery from a perfect score without evidence', () => {
  expect(progressModel(document, [state], [])[0].status).toBe(
    'Not yet assessed',
  );
});
it('requires evidence for the same stable skill and reference', () => {
  expect(
    progressModel(document, [state], [{ id: 'wrong', skill_id: id }])[0].status,
  ).toBe('Not yet assessed');
  expect(
    progressModel(document, [state], [{ id: 'e1', skill_id: 'other' }])[0]
      .status,
  ).toBe('Not yet assessed');
});
it('reports evidence without claiming assessment rules are fulfilled', () => {
  const progress = progressModel(
    document,
    [state],
    [{ id: 'e1', skill_id: id }],
  );
  expect(progress[0]).toMatchObject({
    status: 'Evidence recorded',
    evidenceCount: 2,
  });
  expect(JSON.stringify(progress)).not.toContain('Mastered');
  expect(progress[0]).not.toHaveProperty('masteryScore');
});
it('ignores records outside the pinned curriculum', () => {
  expect(
    progressModel(document, [{ ...state, skill_id: 'foreign' }], []).every(
      (s) => s.evidenceCount === 0,
    ),
  ).toBe(true);
});
it('returns a genuine homework empty state', () => {
  expect(homeworkModel([], [], [])).toEqual([]);
});
it('classifies only recorded assignments, submissions and reviews', () => {
  const assignments = ['a', 'b', 'c'].map((id) => ({ id, due_at: null }));
  expect(
    homeworkModel(
      assignments,
      [
        { id: 'b1', assignment_id: 'b', submitted_at: '2026-01-01' },
        { id: 'c1', assignment_id: 'c', submitted_at: '2026-01-01' },
      ],
      [{ submission_id: 'c1' }],
    ).map((a) => a.status),
  ).toEqual(['Assigned', 'Submitted', 'Reviewed']);
});
it('unrelated submissions and results cannot supply completion', () => {
  expect(
    homeworkModel(
      [{ id: 'a', due_at: null }],
      [{ id: 'other', assignment_id: 'foreign', submitted_at: '2026-01-01' }],
      [{ submission_id: 'other' }],
    )[0].status,
  ).toBe('Assigned');
});
it('planned sessions do not demonstrate attendance', () => {
  expect(
    attendanceModel([{ status: 'planned', started_at: null, ended_at: null }]),
  ).toEqual({ started: false, completed: 0, active: 0 });
});
it('requires recorded start and end for completed attendance', () => {
  expect(
    attendanceModel([
      { status: 'completed', started_at: null, ended_at: null },
      { status: 'completed', started_at: '2026-01-01', ended_at: '2026-01-01' },
    ]),
  ).toEqual({ started: true, completed: 1, active: 0 });
});
it('uses the selected timezone at UTC date boundaries', () => {
  expect(localDate('2026-03-09T03:30:00Z', 'America/New_York')).toBe(
    '2026-03-08',
  );
  expect(localDate('2026-03-08T20:30:00Z', 'Asia/Kolkata')).toBe('2026-03-09');
});
it('weekly boundaries are local Monday through Sunday across DST', () => {
  expect(weekWindow('2026-03-09T03:30:00Z', 'America/New_York', 0)).toEqual({
    start: '2026-03-02',
    end: '2026-03-09',
  });
  expect(weekWindow('2026-03-09T03:30:00Z', 'America/New_York', 1)).toEqual({
    start: '2026-03-09',
    end: '2026-03-16',
  });
});
it('weekly membership excludes the next local Monday', () => {
  const rows = [
    reservation('2026-03-09T03:59:00Z'),
    reservation('2026-03-09T04:00:00Z'),
  ];
  expect(
    weeklyReservations(rows, 'America/New_York', '2026-03-08T12:00:00Z', 0)
      .lessons,
  ).toEqual([rows[0]]);
});
it('formats both repeated fall-back instants accurately', () => {
  expect(formatInstant('2026-11-01T05:30:00Z', 'America/New_York')).toContain(
    '1:30 AM',
  );
  expect(formatInstant('2026-11-01T06:30:00Z', 'America/New_York')).toContain(
    '1:30 AM',
  );
});
it('supports previous weeks and rejects unbounded offsets', () => {
  expect(weekWindow('2026-01-01T12:00:00Z', 'UTC', -1).start).toBe(
    '2025-12-22',
  );
  expect(() => weekWindow('2026-01-01T12:00:00Z', 'UTC', 105)).toThrow();
  expect(() => weekWindow('2026-01-01T12:00:00Z', 'UTC', 0.5)).toThrow();
});
it('upcoming reservations exclude cancelled, completed and past instants', () => {
  const future = reservation('2026-03-09T16:00:00+00:00');
  expect(
    upcomingReservations(
      [
        future,
        reservation('2026-03-08T12:00:00Z'),
        reservation('2026-03-10T16:00:00Z', 'cancelled'),
      ],
      '2026-03-09T12:00:00Z',
    ),
  ).toEqual([future]);
});
it('does not infer assignment state from truncated submission absence', () => {
  expect(
    homeworkModel([{ id: 'a', due_at: null }], [], [], false)[0].status,
  ).toBe('Status unavailable');
});
it('labels repeated local clocks with their actual DST offset names', () => {
  expect(formatInstant('2026-11-01T05:30:00Z', 'America/New_York')).toContain(
    'EDT',
  );
  expect(formatInstant('2026-11-01T06:30:00Z', 'America/New_York')).toContain(
    'EST',
  );
});
