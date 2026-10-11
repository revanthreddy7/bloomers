import type { SchedulePreferences } from './schema';
import type { InitialPlanItem } from './planner';
export type StudentCourseState = {
  enrollmentId: string;
  studentId: string;
  courseId: string;
  curriculumVersionId: string;
  status: 'active' | 'completed';
  initializationState: 'ready' | 'legacy';
};
export type StudentSkillState = {
  skillId: string;
  assessmentState: 'unassessed' | 'evidenced';
  masteryScore: number;
  confidence: number;
  evidenceCount: number;
  lastEvidenceId: string | null;
};
export type PersonalizedRoadmap = {
  enrollment: StudentCourseState;
  skills: StudentSkillState[];
  planId: string;
  planVersion: number;
  items: InitialPlanItem[];
  preferences: SchedulePreferences;
  scheduleIds: string[];
};
export type FutureScheduleChangeProposal = {
  studentCourseId: string;
  expectedPlanVersion: number;
  curriculumVersionId: string;
  reason: string;
  trigger: 'mastery' | 'missed_lesson' | 'homework' | 'parent_request';
  evidenceReferences: string[];
  homeworkOutcomeReferences: string[];
  affectedScheduleIds: string[];
  proposedInstants: { scheduleId: string; startsAt: string; endsAt: string }[];
  requiresApproval: boolean;
};
// Future deterministic consumers must authorize the student, retain the curriculum pin,
// append a change record, lock the plan/student, and validate every new reservation.
