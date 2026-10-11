import { curriculumSchema, type CurriculumDocument } from './schema';

export function orderedStructure(document: CurriculumDocument) {
  return [...document.units].sort(byPosition).map((unit) => ({
    ...unit,
    topics: [...unit.topics].sort(byPosition).map((topic) => ({
      ...topic,
      skills: [...topic.skills].sort(byPosition),
    })),
  }));
}
function byPosition(
  a: { position: number; id: string },
  b: { position: number; id: string },
) {
  return a.position - b.position || a.id.localeCompare(b.id);
}
export function skills(document: CurriculumDocument) {
  return orderedStructure(document).flatMap((unit) =>
    unit.topics.flatMap((topic) => topic.skills),
  );
}
export function validateGraph(document: CurriculumDocument): string[] {
  const nodes = skills(document).map((skill) => skill.id);
  if (new Set(nodes).size !== nodes.length)
    throw new Error('Duplicate skill identity');
  const incoming = new Map(nodes.map((node) => [node, new Set<string>()]));
  const seen = new Set<string>();
  for (const edge of document.prerequisites) {
    if (!incoming.has(edge.skillId) || !incoming.has(edge.prerequisiteId))
      throw new Error('Prerequisite outside course version');
    if (edge.skillId === edge.prerequisiteId)
      throw new Error('Self dependency');
    const key = `${edge.skillId}:${edge.prerequisiteId}`;
    if (seen.has(key)) throw new Error('Duplicate prerequisite');
    seen.add(key);
    incoming.get(edge.skillId)!.add(edge.prerequisiteId);
  }
  const result: string[] = [];
  while (incoming.size) {
    const ready = [...incoming.keys()]
      .filter((node) => incoming.get(node)!.size === 0)
      .sort();
    if (!ready.length) throw new Error('Prerequisite cycle');
    for (const node of ready) {
      result.push(node);
      incoming.delete(node);
      for (const requirements of incoming.values()) requirements.delete(node);
    }
  }
  return result;
}
export function relatedSkills(
  document: CurriculumDocument,
  skillId: string,
  direction: 'prerequisites' | 'dependents',
  transitive = false,
) {
  const order = validateGraph(document);
  if (!order.includes(skillId)) throw new Error('Unknown skill');
  const found = new Set<string>();
  const visit = (node: string) => {
    for (const edge of document.prerequisites) {
      const from =
        direction === 'prerequisites' ? edge.skillId : edge.prerequisiteId;
      const to =
        direction === 'prerequisites' ? edge.prerequisiteId : edge.skillId;
      if (from === node && !found.has(to)) {
        found.add(to);
        if (transitive) visit(to);
      }
    }
  };
  visit(skillId);
  return order.filter((node) => found.has(node));
}
export function validateStructure(input: unknown): CurriculumDocument {
  const document = curriculumSchema.parse(input);
  if (
    new TextEncoder().encode(JSON.stringify(document)).length > 2000000 ||
    skills(document).length > 1000
  )
    throw new Error('Academic document exceeds limits');
  const identities = new Set<string>();
  const check = (items: { id: string; position: number }[]) => {
    const positions = new Set<number>();
    for (const item of items) {
      if (identities.has(item.id) || positions.has(item.position))
        throw new Error('Duplicate identity or position');
      identities.add(item.id);
      positions.add(item.position);
    }
  };
  check(document.units);
  for (const unit of document.units) {
    check(unit.topics);
    for (const topic of unit.topics) {
      check(topic.skills);
      const ids = new Set(topic.skills.map((skill) => skill.id));
      if (
        topic.content.practiceQuestions.some(
          (question) => !ids.has(question.skillId),
        )
      )
        throw new Error('Practice question outside topic');
    }
  }
  validateGraph(document);
  return document;
}
export function publicationIssues(input: unknown): string[] {
  const document = validateStructure(input);
  const issues: string[] = [];
  if (!document.units.length || !document.learningObjectives.length)
    issues.push('Course needs units and learning objectives');
  for (const unit of document.units) {
    if (!unit.topics.length || !unit.learningObjectives.length)
      issues.push(`Unit ${unit.id} needs topics and objectives`);
    for (const topic of unit.topics) {
      const c = topic.content;
      if (
        !topic.skills.length ||
        !topic.teachingObjectives.length ||
        !topic.expectedOutcomes.length ||
        !c.learningObjectives.length ||
        !c.keyConcepts.length ||
        !c.explanations.length ||
        !c.workedExamples.length ||
        !c.commonMistakes.length ||
        !c.practiceQuestions.length ||
        !c.assessmentObjectives.length ||
        !c.whiteboardPlans.length ||
        c.workedExamples.some((example) => !example.steps.length) ||
        c.whiteboardPlans.some((plan) => !plan.steps.length)
      )
        issues.push(`Topic ${topic.id} needs complete teaching content`);
    }
  }
  return issues;
}
