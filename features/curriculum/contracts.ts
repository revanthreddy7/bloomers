import type {
  CurriculumVersion,
  SkillDefinition,
  TopicContent,
} from './schema';

// Contracts only: consumers must authorize the student and resolve the pinned version.
export type EnrollmentCurriculum = {
  courseId: string;
  curriculumVersionId: string;
  requiredSkillIds: string[];
};
export type SchedulingCurriculum = EnrollmentCurriculum & {
  topologicalSkillIds: string[];
  estimatedMinutes: Record<string, number>;
};
export type AssessmentCurriculum = {
  curriculumVersionId: string;
  skill: SkillDefinition;
  privateQuestionIds: string[];
};
export type CurriculumTransitionProposal = {
  studentCourseId: string;
  fromVersionId: string;
  toVersionId: string;
  retainedSkillIds: string[];
  addedSkillIds: string[];
  retiredSkillIds: string[];
  evidenceReferences: string[];
  reason: string;
  expectedRevision: number;
};
export type TeachingPolicyReference = {
  id: string;
  version: number;
  scope: 'global' | 'subject';
  status: 'published';
};
export type LessonContextPackage = {
  schemaVersion: 1;
  studentId: string;
  lessonId: string;
  curriculum: CurriculumVersion & { status: 'published' };
  topicId: string;
  targetSkills: SkillDefinition[];
  academicContent: TopicContent;
  teachingPolicies: TeachingPolicyReference[];
  evidenceReferences: string[];
  instructionalPreferences: string[];
  safetyPolicyVersion: string;
  authorizationDecisionId: string;
};
