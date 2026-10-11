import {
  lessonContextSchema,
  teachingPlanSchema,
  type LessonContext,
} from './contracts';
import templates from './mock-lessons.json';
export function buildMockPlan(input: LessonContext) {
  const context = lessonContextSchema.parse(input);
  const skill = context.skills[0];
  const code = skill.code as keyof typeof templates;
  if (!(code in templates))
    throw new Error('No reviewed simulation for this planned skill.');
  return validatePlan(
    {
      schemaVersion: 1,
      objective: context.objectives[0],
      reviewSkills: skill.prerequisites,
      newSkills: [skill.id],
      steps: templates[code],
      understandingChecks: templates[code].flatMap((s) =>
        s.question ? [s.question] : [],
      ),
      homeworkIntent: null,
      provenance: {
        provider: 'mock',
        plannerVersion: 'mock-planner-1',
        policyVersion: context.policyVersion,
        publicationReference: context.publicationReference,
      },
    },
    context,
  );
}
export function validatePlan(value: unknown, context: LessonContext) {
  const plan = teachingPlanSchema.parse(value);
  const selected = new Set(context.skills.map((s) => s.id));
  const prerequisites = new Set(context.skills.flatMap((s) => s.prerequisites));
  if (
    plan.provenance.publicationReference !== context.publicationReference ||
    !context.objectives.includes(plan.objective) ||
    plan.newSkills.some((id) => !selected.has(id)) ||
    plan.reviewSkills.some((id) => !prerequisites.has(id))
  )
    throw new Error('Teaching plan is outside the pinned lesson.');
  for (const step of plan.steps)
    if (step.offsetMs >= step.durationMs)
      throw new Error('Invalid narration timing.');
  return plan;
}
