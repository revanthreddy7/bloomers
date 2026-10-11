import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import sample from '@/supabase/fixtures/grade-8.json';
import jsonSchema from '@/features/curriculum/document.schema.json';
import { curriculumSchema } from '@/features/curriculum/schema';
import {
  validateStructure,
  publicationIssues,
  validateGraph,
  skills,
  relatedSkills,
  orderedStructure,
} from '@/features/curriculum/engine';
const fresh = () => curriculumSchema.parse(structuredClone(sample));
const id = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
describe('academic structure and publication', () => {
  it('preserves the five stable skills and complete representative content', () => {
    const d = validateStructure(sample);
    expect(skills(d).map((s) => s.id)).toEqual([11, 12, 13, 14, 15].map(id));
    expect(publicationIssues(d)).toEqual([]);
    expect(d.units[0].topics[0].content.workedExamples[0].steps).toHaveLength(
      3,
    );
  });
  it('sorts units, topics and skills without mutating stored data', () => {
    const d = fresh();
    const t = d.units[0].topics[0];
    t.skills.reverse();
    const second = structuredClone(d.units[0]);
    second.id = id(200);
    second.position = 2;
    const secondTopic = structuredClone(t);
    secondTopic.id = id(201);
    secondTopic.position = 2;
    d.units[0].topics.unshift(secondTopic);
    d.units.unshift(second);
    expect(orderedStructure(d).map((u) => u.position)).toEqual([1, 2]);
    expect(orderedStructure(d)[0].topics.map((t) => t.position)).toEqual([
      1, 2,
    ]);
    expect(skills(fresh()).map((s) => s.position)).toEqual([1, 2, 3, 4, 5]);
    expect(orderedStructure(d)[0].topics[0].skills[0].id).toBe(id(11));
    expect(t.skills[0].id).toBe(id(15));
  });
  it.each([
    'learningObjectives',
    'explanations',
    'workedExamples',
    'commonMistakes',
    'practiceQuestions',
    'assessmentObjectives',
    'whiteboardPlans',
  ] as const)('requires %s before publication', (field) => {
    const d = fresh();
    d.units[0].topics[0].content[field] = [];
    expect(publicationIssues(d)).not.toHaveLength(0);
  });
  it('accepts incomplete drafts but rejects publishing empty units', () => {
    const d = fresh();
    d.units = [];
    d.prerequisites = [];
    expect(validateStructure(d)).toEqual(d);
    expect(publicationIssues(d)).not.toHaveLength(0);
  });
  it('rejects duplicate positions and identities', () => {
    const d = fresh();
    const topic = d.units[0].topics[0];
    topic.skills[1].position = 1;
    expect(() => validateStructure(d)).toThrow('Duplicate');
    topic.skills[1].position = 2;
    topic.skills[1].id = topic.skills[0].id;
    expect(() => validateStructure(d)).toThrow('Duplicate');
  });
  it('rejects private answers, internal prompts and arbitrary configuration', () => {
    const d = fresh();
    Object.assign(d.units[0].topics[0].content.practiceQuestions[0], {
      answer: 13,
    });
    expect(() => validateStructure(d)).toThrow();
    const other = fresh();
    Object.assign(other, { systemPrompt: 'secret' });
    expect(() => validateStructure(other)).toThrow();
  });
  it.each([0, 1.2, -1])('rejects invalid mastery threshold %s', (threshold) => {
    const d = fresh();
    d.units[0].topics[0].skills[0].masteryThreshold = threshold;
    expect(() => validateStructure(d)).toThrow();
  });
  it('validates question membership in the topic', () => {
    const d = fresh();
    d.units[0].topics[0].content.practiceQuestions[0].skillId = id(999);
    expect(() => validateStructure(d)).toThrow('outside topic');
  });
  it('keeps the frozen DB schema and seed snapshot aligned with runtime validation', () => {
    expect(z.toJSONSchema(curriculumSchema, { target: 'draft-7' })).toEqual(
      jsonSchema,
    );
    const migration = readFileSync(
      'supabase/migrations/202610100004_curriculum.sql',
      'utf8',
    );
    expect(JSON.parse(migration.split('$json$')[1])).toEqual(jsonSchema);
    const seed = readFileSync('supabase/seed.sql', 'utf8');
    expect(JSON.parse(seed.split('$academic$')[1])).toEqual(sample);
  });
});
describe('version-scoped prerequisite DAG', () => {
  it('returns direct, transitive and dependent skills in deterministic order', () => {
    const d = fresh();
    expect(relatedSkills(d, id(14), 'prerequisites')).toEqual([id(13)]);
    expect(relatedSkills(d, id(15), 'prerequisites', true)).toEqual(
      [11, 12, 13, 14].map(id),
    );
    expect(relatedSkills(d, id(11), 'dependents', true)).toEqual(
      [13, 14, 15].map(id),
    );
    expect(relatedSkills(d, id(12), 'prerequisites', true)).toEqual([]);
  });
  it('returns a deterministic topological order independent of edge and node storage order', () => {
    const d = fresh();
    d.prerequisites.reverse();
    d.units[0].topics[0].skills.reverse();
    expect(validateGraph(d)).toEqual([11, 12, 13, 14, 15].map(id));
  });
  it('rejects cycles', () => {
    const d = fresh();
    d.prerequisites.push({ skillId: id(11), prerequisiteId: id(15) });
    expect(() => validateGraph(d)).toThrow('cycle');
  });
  it('rejects self dependencies', () => {
    const d = fresh();
    d.prerequisites.push({ skillId: id(11), prerequisiteId: id(11) });
    expect(() => validateGraph(d)).toThrow('Self');
  });
  it('rejects foreign-version references', () => {
    const d = fresh();
    d.prerequisites.push({ skillId: id(11), prerequisiteId: id(900) });
    expect(() => validateGraph(d)).toThrow('outside');
  });
  it('rejects repeated edges', () => {
    const d = fresh();
    d.prerequisites.push(d.prerequisites[0]);
    expect(() => validateGraph(d)).toThrow('Duplicate');
  });
  it('rejects unknown skill retrieval', () => {
    expect(() => relatedSkills(fresh(), id(900), 'prerequisites')).toThrow(
      'Unknown',
    );
  });
});
