import { skills, validateStructure } from '../curriculum/engine';
import type { CurriculumDocument } from '../curriculum/schema';
export type InitialPlanItem = {
  position: number;
  skillId: string;
  lessonPosition: number;
  estimatedMinutes: number;
  objectives: string[];
};
// Known initial states are never treated as diagnostic evidence or prior mastery.
export function initialPlan(input: unknown, duration: number) {
  const document = validateStructure(input);
  if (!Number.isInteger(duration) || duration < 20 || duration > 90)
    throw new Error('Lesson duration must be 20–90 minutes');
  const ordered = academicPrerequisiteOrder(document);
  const items: InitialPlanItem[] = [];
  let lessonPosition = 1,
    remaining = duration;
  for (const skill of ordered) {
    let minutes = skill.estimatedMinutes;
    while (minutes > 0) {
      if (remaining === 0) {
        lessonPosition++;
        remaining = duration;
      }
      const allocated = Math.min(remaining, minutes);
      items.push({
        position: items.length + 1,
        skillId: skill.id,
        lessonPosition,
        estimatedMinutes: allocated,
        objectives: [skill.description],
      });
      remaining -= allocated;
      minutes -= allocated;
    }
  }
  if (!items.length || lessonPosition > 200)
    throw new Error('Course requires between 1 and 200 projected lessons');
  return {
    algorithmVersion: 'initial-v1' as const,
    items,
    lessonCount: lessonPosition,
    totalEstimatedMinutes: items.reduce(
      (sum, item) => sum + item.estimatedMinutes,
      0,
    ),
  };
}
export function academicPrerequisiteOrder(document: CurriculumDocument) {
  const ordered = skills(document),
    completed = new Set<string>(),
    result: typeof ordered = [];
  while (result.length < ordered.length) {
    const next = ordered.find(
      (skill) =>
        !completed.has(skill.id) &&
        document.prerequisites
          .filter((edge) => edge.skillId === skill.id)
          .every((edge) => completed.has(edge.prerequisiteId)),
    );
    if (!next) throw new Error('Invalid prerequisite graph');
    completed.add(next.id);
    result.push(next);
  }
  return result;
}
