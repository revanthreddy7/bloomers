import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import sample from '@/supabase/fixtures/grade-8.json';
import schema from '@/features/planning/preferences.schema.json';
import { curriculumSchema } from '@/features/curriculum/schema';
import {
  initialPlan,
  academicPrerequisiteOrder,
} from '@/features/planning/planner';
import {
  initialSchedule,
  resolveLocalTime,
  overlaps,
  completionEstimate,
} from '@/features/planning/scheduler';
import {
  schedulePreferencesSchema,
  validatePreferences,
  type SchedulePreferences,
} from '@/features/planning/schema';
const prefs: SchedulePreferences = {
  schemaVersion: 1,
  timezone: 'America/New_York',
  lessonDurationMinutes: 30,
  weeklyFrequency: 2,
  slots: [
    { weekday: 1, time: '16:00' },
    { weekday: 3, time: '16:00' },
  ],
  earliestDate: '2026-03-02',
};
const now = new Date('2026-03-01T12:00:00Z');
describe('deterministic academic planning', () => {
  it('groups work into four 30-minute lessons and preserves all 120 estimated minutes', () => {
    const plan = initialPlan(sample, 30);
    expect(plan.lessonCount).toBe(4);
    expect(plan.totalEstimatedMinutes).toBe(120);
    expect(plan.items).toHaveLength(7);
    expect(plan.items.map((item) => item.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    for (let lesson = 1; lesson <= 4; lesson++)
      expect(
        plan.items
          .filter((item) => item.lessonPosition === lesson)
          .reduce((sum, item) => sum + item.estimatedMinutes, 0),
      ).toBe(30);
  });
  it('places every prerequisite segment before dependent work', () => {
    const plan = initialPlan(sample, 20);
    for (const edge of sample.prerequisites) {
      const before = plan.items
        .filter((item) => item.skillId === edge.prerequisiteId)
        .at(-1)!;
      const after = plan.items.find((item) => item.skillId === edge.skillId)!;
      expect(before.position).toBeLessThan(after.position);
    }
  });
  it('uses academic order to break prerequisite ties, not stored array order', () => {
    const d = curriculumSchema.parse(structuredClone(sample));
    d.units[0].topics[0].skills.reverse();
    d.prerequisites.reverse();
    expect(initialPlan(d, 30)).toEqual(initialPlan(sample, 30));
    const reordered = curriculumSchema.parse(structuredClone(sample));
    reordered.units[0].topics[0].skills[0].position = 2;
    reordered.units[0].topics[0].skills[1].position = 1;
    expect(academicPrerequisiteOrder(reordered)[0].code).toBe('fractions');
  });
  it('retains objectives without declaring mastery', () => {
    expect(
      initialPlan(sample, 30).items.every(
        (item) => item.objectives.length === 1,
      ),
    ).toBe(true);
    expect(initialPlan(sample, 30)).not.toHaveProperty('mastery');
  });
  it('does not mutate the source curriculum', () => {
    const d = structuredClone(sample);
    initialPlan(d, 25);
    expect(d).toEqual(sample);
  });
  it.each([0, 19, 91, 30.5])('rejects unsupported duration %s', (duration) =>
    expect(() => initialPlan(sample, duration)).toThrow(),
  );
  it('rejects cycles and out-of-version prerequisites', () => {
    const d = structuredClone(sample);
    d.prerequisites.push({
      skillId: d.units[0].topics[0].skills[0].id,
      prerequisiteId: d.units[0].topics[0].skills[4].id,
    });
    expect(() => initialPlan(d, 30)).toThrow('cycle');
    d.prerequisites.at(-1)!.prerequisiteId =
      '00000000-0000-0000-0000-000000009999';
    expect(() => initialPlan(d, 30)).toThrow('outside');
  });
  it('splits large skills and bounds the projection', () => {
    const d = structuredClone(sample);
    d.units[0].topics[0].skills[0].estimatedMinutes = 95;
    const p = initialPlan(d, 30);
    expect(
      p.items
        .filter((i) => i.skillId === d.units[0].topics[0].skills[0].id)
        .map((i) => i.estimatedMinutes),
    ).toEqual([30, 30, 30, 5]);
  });
});
describe('calendar scheduling', () => {
  it('keeps weekly local times stable across DST while changing UTC offsets', () => {
    const schedule = initialSchedule(prefs, 4, now);
    expect(schedule.map((s) => s.startsAt)).toEqual([
      '2026-03-02T21:00:00.000Z',
      '2026-03-04T21:00:00.000Z',
      '2026-03-09T20:00:00.000Z',
      '2026-03-11T20:00:00.000Z',
    ]);
    expect(completionEstimate(schedule)).toBe('2026-03-11T20:30:00.000Z');
    expect(initialSchedule(prefs, 4, now)).toEqual(schedule);
  });
  it('supports a fractional-hour timezone', () =>
    expect(resolveLocalTime('2026-03-02', '16:00', 'Asia/Kolkata')).toBe(
      '2026-03-02T10:30:00.000Z',
    ));
  it('rejects nonexistent spring-forward times', () =>
    expect(() =>
      resolveLocalTime('2026-03-08', '02:30', 'America/New_York'),
    ).toThrow('ambiguous or nonexistent'));
  it('rejects ambiguous fall-back times', () =>
    expect(() =>
      resolveLocalTime('2026-11-01', '01:30', 'America/New_York'),
    ).toThrow('ambiguous or nonexistent'));
  it('rejects half-hour DST gaps and folds', () => {
    expect(() =>
      resolveLocalTime('2026-10-04', '02:15', 'Australia/Lord_Howe'),
    ).toThrow();
    expect(() =>
      resolveLocalTime('2026-04-05', '01:45', 'Australia/Lord_Howe'),
    ).toThrow();
  });
  it('uses elapsed lesson duration across a timezone transition', () => {
    const p = {
      ...prefs,
      earliestDate: '2026-03-08',
      weeklyFrequency: 1,
      slots: [{ weekday: 0, time: '01:45' }],
    };
    const s = initialSchedule(p, 1, now)[0];
    expect(Date.parse(s.endsAt) - Date.parse(s.startsAt)).toBe(30 * 60000);
  });
  it('skips already elapsed slots on the allowed starting day', () => {
    const p = { ...prefs, earliestDate: '2026-03-02' };
    expect(
      initialSchedule(p, 1, new Date('2026-03-02T22:00:00Z'))[0].localDate,
    ).toBe('2026-03-04');
  });
  it('rejects invalid dates, unknown zones and invented availability', () => {
    expect(() =>
      validatePreferences({ ...prefs, earliestDate: '2026-02-30' }),
    ).toThrow();
    expect(() =>
      validatePreferences({ ...prefs, timezone: 'Unknown/Place' }),
    ).toThrow();
    expect(() => validatePreferences({ ...prefs, slots: [] })).toThrow();
    expect(() =>
      validatePreferences({
        ...prefs,
        slots: [prefs.slots[0], prefs.slots[0]],
      }),
    ).toThrow();
  });
  it('rejects mismatched weekly frequency', () =>
    expect(() =>
      validatePreferences({ ...prefs, weeklyFrequency: 3 }),
    ).toThrow());
  it('rejects starting dates in the past or more than a year ahead', () => {
    expect(() =>
      initialSchedule({ ...prefs, earliestDate: '2026-02-28' }, 2, now),
    ).toThrow();
    expect(() =>
      initialSchedule({ ...prefs, earliestDate: '2028-03-01' }, 2, now),
    ).toThrow();
  });
  it('checks half-open intervals: touching is allowed, overlaps are conflicts', () => {
    const s = initialSchedule(prefs, 1, now)[0];
    expect(
      overlaps(s, {
        startsAt: s.endsAt,
        endsAt: new Date(Date.parse(s.endsAt) + 1000).toISOString(),
      }),
    ).toBe(false);
    expect(overlaps(s, { startsAt: s.startsAt, endsAt: s.endsAt })).toBe(true);
  });
  it('freezes database JSON shape alongside runtime schema', () => {
    expect(
      z.toJSONSchema(schedulePreferencesSchema, { target: 'draft-7' }),
    ).toEqual(schema);
    const migration = readFileSync(
      'supabase/migrations/202610100005_planning.sql',
      'utf8',
    );
    expect(JSON.parse(migration.split('$json$')[1])).toEqual(schema);
  });
});
