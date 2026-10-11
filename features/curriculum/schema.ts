import { z } from 'zod';

const text = z.string().min(1).max(2000).regex(/\S/);
const name = z.string().min(1).max(200).regex(/\S/);
// PostgreSQL UUIDs include the deterministic legacy identifiers (version nibble 0).
export const academicIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const id = academicIdSchema;
const texts = z.array(text).max(100);
const resource = z.strictObject({ label: name, reference: text });
export const topicContentSchema = z.strictObject({
  learningObjectives: texts,
  keyConcepts: texts,
  explanations: texts,
  workedExamples: z
    .array(z.strictObject({ problem: text, steps: texts }))
    .max(100),
  commonMistakes: texts,
  practiceQuestions: z
    .array(z.strictObject({ skillId: id, prompt: text }))
    .max(100),
  assessmentObjectives: texts,
  whiteboardPlans: z
    .array(z.strictObject({ title: name, steps: texts }))
    .max(100),
  resourceReferences: z.array(resource).max(100),
});
export const skillSchema = z.strictObject({
  id,
  code: name,
  name,
  description: text,
  position: z.number().int().positive(),
  difficulty: z.number().int().min(1).max(5),
  estimatedMinutes: z.number().int().min(1).max(600),
  masteryThreshold: z.number().gt(0).lte(1),
  assessment: z.strictObject({
    independentCorrectRequired: z.number().int().min(1).max(20),
    allowHintsForMastery: z.boolean(),
  }),
});
export const curriculumSchema = z.strictObject({
  schemaVersion: z.literal(1),
  curriculumId: id,
  name,
  description: text,
  academicLevel: z.number().int().min(1).max(12),
  subject: name,
  learningObjectives: texts,
  units: z
    .array(
      z.strictObject({
        id,
        name,
        description: text,
        position: z.number().int().positive(),
        learningObjectives: texts,
        topics: z
          .array(
            z.strictObject({
              id,
              name,
              description: text,
              position: z.number().int().positive(),
              teachingObjectives: texts,
              expectedOutcomes: texts,
              content: topicContentSchema,
              skills: z.array(skillSchema).max(1000),
            }),
          )
          .max(500),
      }),
    )
    .max(100),
  prerequisites: z
    .array(z.strictObject({ skillId: id, prerequisiteId: id }))
    .max(10000),
});
export type CurriculumDocument = z.infer<typeof curriculumSchema>;
export type SkillDefinition = z.infer<typeof skillSchema>;
export type TopicContent = z.infer<typeof topicContentSchema>;
export type CurriculumVersion = {
  id: string;
  courseId: string;
  version: number;
  revision: number;
  status: 'draft' | 'published';
  publishedAt: string | null;
  document: CurriculumDocument;
};
