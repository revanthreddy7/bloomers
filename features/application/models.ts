import { orderedStructure, skills } from '@/features/curriculum/engine';
import type { CurriculumDocument } from '@/features/curriculum/schema';
export type LearningView =
  'overview' | 'course' | 'progress' | 'homework' | 'schedule';
export const learningViews: LearningView[] = [
  'overview',
  'course',
  'progress',
  'homework',
  'schedule',
];
export type SkillRecord = {
  skill_id: string;
  assessment_state: string;
  evidence_count: number;
  last_evidence_id: string | null;
  mastery_score: number;
  confidence: number;
};
export type EvidenceReference = { id: string; skill_id: string };
export function progressModel(
  document: CurriculumDocument,
  records: SkillRecord[],
  evidence: EvidenceReference[],
) {
  return skills(document).map((skill) => {
    const record = records.find((r) => r.skill_id === skill.id);
    const supported =
      record?.assessment_state === 'evidenced' &&
      record.evidence_count > 0 &&
      evidence.some(
        (e) => e.id === record.last_evidence_id && e.skill_id === skill.id,
      );
    // A score and provenance alone do not prove the independent-correct/hint
    // requirements of this publication. Phase 7 will supply reviewed states.
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      status: supported ? 'Evidence recorded' : 'Not yet assessed',
      evidenceCount: supported ? record.evidence_count : 0,
    };
  });
}
export function academicModel(document: CurriculumDocument) {
  return orderedStructure(document).map((unit) => ({
    id: unit.id,
    name: unit.name,
    topics: unit.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      skills: topic.skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        prerequisites: document.prerequisites
          .filter((e) => e.skillId === skill.id)
          .map(
            (e) =>
              skills(document).find((s) => s.id === e.prerequisiteId)!.name,
          ),
      })),
    })),
  }));
}
export type Reservation = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  timezone: string | null;
  lesson_position: number | null;
  course_plan_id: string | null;
};
export function formatInstant(instant: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(instant));
}
export function localDate(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function weekWindow(now: string, timezone: string, offset: number) {
  if (!Number.isInteger(offset) || Math.abs(offset) > 104)
    throw new Error('Week unavailable');
  const date = new Date(`${localDate(now, timezone)}T12:00:00Z`);
  date.setUTCDate(
    date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + offset * 7,
  );
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 7);
  return { start, end: date.toISOString().slice(0, 10) };
}
export function weeklyReservations(
  rows: Reservation[],
  timezone: string,
  now: string,
  offset: number,
) {
  const window = weekWindow(now, timezone, offset);
  return {
    ...window,
    lessons: rows
      .filter((row) => {
        const date = localDate(row.starts_at, timezone);
        return date >= window.start && date < window.end;
      })
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
  };
}
export function upcomingReservations(rows: Reservation[], now: string) {
  return rows
    .filter(
      (row) =>
        row.status === 'scheduled' &&
        Date.parse(row.starts_at) > Date.parse(now),
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}
export type HomeworkAssignment = { id: string; due_at: string | null };
export function homeworkModel(
  assignments: HomeworkAssignment[],
  submissions: { id: string; assignment_id: string; submitted_at: string }[],
  results: { submission_id: string }[],
  submissionsComplete = true,
) {
  return assignments.map((assignment) => {
    const submitted = submissions.filter(
      (s) => s.assignment_id === assignment.id,
    );
    const reviewed = submitted.some((s) =>
      results.some((r) => r.submission_id === s.id),
    );
    return {
      id: assignment.id,
      dueAt: assignment.due_at,
      status: reviewed
        ? 'Reviewed'
        : submitted.length
          ? 'Submitted'
          : submissionsComplete
            ? 'Assigned'
            : 'Status unavailable',
    };
  });
}
export function attendanceModel(
  rows: {
    status: string;
    started_at: string | null;
    ended_at: string | null;
    classroom_mode?: string;
  }[],
) {
  rows = rows.filter((r) => r.classroom_mode !== 'supervised_preview');
  return {
    started: rows.some((r) => !!r.started_at),
    completed: rows.filter(
      (r) => r.status === 'completed' && r.started_at && r.ended_at,
    ).length,
    active: rows.filter((r) => r.status === 'active' && r.started_at).length,
  };
}
