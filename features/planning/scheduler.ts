import { validatePreferences, type SchedulePreferences } from './schema';
function formatter(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}
function localEpoch(instant: number, timezone: string) {
  const parts = formatter(timezone).formatToParts(instant);
  const value = (name: string) =>
    Number(parts.find((p) => p.type === name)!.value);
  return Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
}
export function resolveLocalTime(date: string, time: string, timezone: string) {
  const local = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(local)) throw new Error('Invalid local time');
  const offsets = new Set<number>();
  for (let delta = -48; delta <= 48; delta += 12) {
    const probe = local + delta * 3600000;
    offsets.add(localEpoch(probe, timezone) - probe);
  }
  const candidates = [...offsets]
    .map((offset) => local - offset)
    .filter((instant) => localEpoch(instant, timezone) === local);
  if (candidates.length !== 1)
    throw new Error(
      'Local time is ambiguous or nonexistent; choose another time',
    );
  return new Date(candidates[0]).toISOString();
}
export type ProjectedLesson = {
  position: number;
  startsAt: string;
  endsAt: string;
  timezone: string;
  localDate: string;
  localTime: string;
};
export function initialSchedule(
  input: unknown,
  lessonCount: number,
  now: Date,
) {
  const preferences = validatePreferences(input);
  if (!Number.isInteger(lessonCount) || lessonCount < 1 || lessonCount > 200)
    throw new Error('Invalid lesson count');
  const start = new Date(`${preferences.earliestDate}T00:00:00Z`);
  const today = new Date(localEpoch(now.getTime(), preferences.timezone))
    .toISOString()
    .slice(0, 10);
  if (
    preferences.earliestDate < today ||
    start.getTime() > Date.parse(`${today}T00:00:00Z`) + 365 * 86400000
  )
    throw new Error('Starting date must be within the next year');
  const schedule: ProjectedLesson[] = [];
  for (
    let offset = 0;
    offset <= 730 && schedule.length < lessonCount;
    offset++
  ) {
    const day = new Date(start.getTime() + offset * 86400000),
      date = day.toISOString().slice(0, 10);
    for (const slot of preferences.slots.filter(
      (s) => s.weekday === day.getUTCDay(),
    )) {
      const startsAt = resolveLocalTime(date, slot.time, preferences.timezone);
      if (Date.parse(startsAt) <= now.getTime()) continue;
      schedule.push({
        position: schedule.length + 1,
        startsAt,
        endsAt: new Date(
          Date.parse(startsAt) + preferences.lessonDurationMinutes * 60000,
        ).toISOString(),
        timezone: preferences.timezone,
        localDate: date,
        localTime: slot.time,
      });
    }
  }
  if (schedule.length !== lessonCount)
    throw new Error('Schedule exceeds the supported two-year horizon');
  return schedule;
}
export function completionEstimate(schedule: ProjectedLesson[]) {
  return schedule.at(-1)?.endsAt ?? null;
}
export function overlaps(
  a: Pick<ProjectedLesson, 'startsAt' | 'endsAt'>,
  b: Pick<ProjectedLesson, 'startsAt' | 'endsAt'>,
) {
  return (
    Date.parse(a.startsAt) < Date.parse(b.endsAt) &&
    Date.parse(b.startsAt) < Date.parse(a.endsAt)
  );
}
export function preferencesSummary(p: SchedulePreferences) {
  return `${p.weeklyFrequency} lessons/week · ${p.lessonDurationMinutes} minutes · ${p.timezone}`;
}
