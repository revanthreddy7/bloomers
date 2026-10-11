import 'server-only';
import { z } from 'zod';
import {
  academicIdSchema,
  type CurriculumVersion,
} from '@/features/curriculum/schema';
import {
  validateStructure,
  publicationIssues,
  orderedStructure,
  skills,
  relatedSkills,
} from '@/features/curriculum/engine';
import { requireAcademicReader, requireAcademicAdmin } from './access';
import type { Database, Json } from '@/types/database';

type Row = Database['public']['Tables']['curriculum_versions']['Row'];
function version(row: Row): CurriculumVersion {
  if (row.status !== 'draft' && row.status !== 'published')
    throw new Error('Invalid publication state');
  return {
    id: row.id,
    courseId: row.course_id,
    version: row.version,
    revision: row.revision,
    status: row.status,
    publishedAt: row.published_at,
    document: validateStructure(row.document),
  };
}
export async function listPublishedCourses() {
  const { client } = await requireAcademicReader();
  const { data, error } = await client
    .from('curriculum_versions')
    .select('*')
    .eq('status', 'published')
    .order('version', { ascending: false })
    .order('course_id');
  if (error) throw new Error('Unable to retrieve published courses');
  const latest = new Map<string, CurriculumVersion>();
  for (const row of data)
    if (!latest.has(row.course_id)) latest.set(row.course_id, version(row));
  return [...latest.values()].sort(
    (a, b) =>
      a.document.name.localeCompare(b.document.name) ||
      a.courseId.localeCompare(b.courseId),
  );
}
export async function getCurriculumVersion(versionId: string) {
  academicIdSchema.parse(versionId);
  const { client } = await requireAcademicReader();
  const { data, error } = await client
    .from('curriculum_versions')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();
  if (error) throw new Error('Unable to retrieve course version');
  return data ? version(data) : null;
}
export async function getPublishedCourse(courseId: string, versionId?: string) {
  academicIdSchema.parse(courseId);
  const selected = versionId
    ? await getCurriculumVersion(versionId)
    : (await listPublishedCourses()).find((v) => v.courseId === courseId);
  if (
    !selected ||
    selected.courseId !== courseId ||
    selected.status !== 'published'
  )
    return null;
  return { ...selected, units: orderedStructure(selected.document) };
}
export async function getSkillDefinition(versionId: string, skillId: string) {
  const v = await getCurriculumVersion(versionId);
  return v
    ? (skills(v.document).find((skill) => skill.id === skillId) ?? null)
    : null;
}
export async function getSkillRelations(
  versionId: string,
  skillId: string,
  direction: 'prerequisites' | 'dependents',
  transitive = false,
) {
  const v = await getCurriculumVersion(versionId);
  if (!v) return null;
  return relatedSkills(v.document, skillId, direction, transitive);
}
export async function getTopicContent(versionId: string, topicId: string) {
  const v = await getCurriculumVersion(versionId);
  return v
    ? (orderedStructure(v.document)
        .flatMap((unit) => unit.topics)
        .find((topic) => topic.id === topicId) ?? null)
    : null;
}
// Internal services only. No authoring routes or server actions are exported to the browser.
export async function saveDraft(input: {
  courseId: string;
  versionId?: string;
  expectedRevision: number;
  document: unknown;
}) {
  const { client } = await requireAcademicAdmin();
  academicIdSchema.parse(input.courseId);
  if (input.versionId) academicIdSchema.parse(input.versionId);
  z.number().int().min(0).parse(input.expectedRevision);
  const document = validateStructure(input.document);
  const { data, error } = await client.rpc('save_curriculum_draft', {
    p_course_id: input.courseId,
    p_version_id: input.versionId,
    p_expected_revision: input.expectedRevision,
    p_document: document as unknown as Json,
  });
  if (error) throw new Error(`Draft save failed (${error.code})`);
  return data;
}
export async function publishVersion(
  versionId: string,
  expectedRevision: number,
) {
  const { client } = await requireAcademicAdmin();
  academicIdSchema.parse(versionId);
  z.number().int().positive().parse(expectedRevision);
  const v = await getCurriculumVersion(versionId);
  if (!v || publicationIssues(v.document).length)
    throw new Error('Version is not publication ready');
  const { data, error } = await client.rpc('publish_curriculum_version', {
    p_version_id: versionId,
    p_expected_revision: expectedRevision,
  });
  if (error) throw new Error(`Publication failed (${error.code})`);
  return data;
}
