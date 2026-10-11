# Curriculum schema and future Curriculum Studio

The academic hierarchy uses the existing stable `curricula`, `courses`, `units`, `topics`, and `skills` identities. The topic is the chapter. The authoritative editable content is a complete course document in `curriculum_versions`, with `(course_id, version)` uniqueness, status, revision, creator, publication actor/time, and an immutable publication ID. Legacy prerequisite/map tables are compatibility data, never inputs to new planning services.

## Document version 1

See `features/curriculum/schema.ts` for strict runtime schemas and `document.schema.json` for the database JSON Schema. Unknown fields are rejected, including private answer fields and system prompts.

| Entity  | Version-specific fields                                                                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course  | Name, description, grade 1–12, subject, objectives, curriculum association                                                                                                                                 |
| Unit    | Stable ID, name, description, positive unique position, learning objectives                                                                                                                                |
| Topic   | Stable ID, name, description, position, teaching objectives, expected outcomes, skills, content                                                                                                            |
| Skill   | Stable ID and immutable code, name, description, position, difficulty 1–5, minutes 1–600, mastery threshold (0,1], independent-correct requirement, hint policy                                            |
| Content | Learning objectives, key concepts, explanations, worked example steps, common mistakes, practice prompts with topic skill references, assessment objectives, whiteboard steps, labeled resource references |
| Graph   | `{skillId, prerequisiteId}` edges entirely inside this version; no duplicates, self edges, or cycles                                                                                                       |

Names and text are bounded and must contain non-whitespace characters. Identity and sibling-position duplicates are rejected. Total document size is bounded to 2 MB and total skills to 1,000. Empty objectives/content collections are allowed while drafting; publication requires nonempty course/unit/topic objectives, skills, concepts, explanations, examples/steps, mistakes, practice, assessment objectives, and whiteboard plans/steps. Resources are optional opaque references, rendered as text; they are not fetched or ingested. Public worked examples deliberately include teaching solutions; private assessment answer keys live separately in `questions.answer`.

## Services and contracts

`server/curriculum/service.ts` lists latest publications by course, resolves an exact version or published course structure, retrieves skills, direct/transitive prerequisites and dependents, and topic objectives/content. `features/curriculum/engine.ts` provides deterministic position ordering, graph validation/topological order, and readiness checks. Topological ties use stable UUID order; prerequisite and dependent results follow that order.

Internal `saveDraft` and `publishVersion` authenticate canonical verified administrators before invoking narrowly scoped authenticated RPCs. There is no public authoring route. Save accepts expected revision zero for a new draft, or the exact current revision for an existing draft; successful edits increment revision. A stale edit/publication fails with PostgreSQL `40001`. Publish requires the expected current revision and audits once. Always reload and reconcile a conflict; do not overwrite by guessing the new revision.

The actor is never an input. To provision a founder/admin account later, create and verify the Auth account, then have a trusted database operator review its UUID and insert a canonical ADMIN `public.users` row. Do not change user metadata or add a self-promotion endpoint. No production founder identity is created here; administrator fixtures are synthetic local tests.

`features/curriculum/contracts.ts` defines future enrollment requirements, scheduling order/time, assessment configuration, controlled version transitions, teaching-policy references, and the conceptual Lesson Context Package. These are integration contracts, not implemented enrollment, scheduling, assessment, mastery, or Maya workflows. Those services must authorize the student and use the enrollment's exact published version, rather than the catalog's latest publication. New learning events/lesson records must capture this version explicitly when their workflows are implemented; Phase 2 does not infer versions for unrelated legacy lesson records.

## Future editor workflow

1. Authorize an academic administrator and load a publication or draft.
2. Clone into a new draft; preserve IDs for the same academic meaning. A genuinely new skill needs a new stable ID/code.
3. Add/remove/reorder units, topics, skills, structured content, and prerequisite edges within that course. Removal from a draft does not delete identities or prior published content. Topic/skill reassociation within a course is supported; cross-course identity reuse is rejected.
4. Save with the known revision, preview content, validate the graph and publication readiness, and review pedagogy privately.
5. Publish explicitly. Existing student pins remain unchanged. Roll back by publishing reviewed old content under a new version number.
6. Add uploads later through private storage, consent/authorization, content review, and ingestion validation. A resource reference alone grants no file access.

Complete Studio UI, review approvals, preview diff tooling, draft archival, uploads, ingestion, AI generation, and teaching-policy editing remain future work. Database versions cannot currently be deleted, including drafts; archival needs a reviewed additive lifecycle.

## Controlled student transition — future only

Build a proposal comparing old and new published requirements by stable skill ID: retained, added, retired, changed assessment requirements, and prerequisite differences. Preserve all prior evidence and historical plans. Check whether previous evidence satisfies changed requirements; never silently infer mastery. Include evidence references, reason, expected enrollment revision, actor, and the appropriate reviewed approval policy. One transaction must lock enrollment, validate source/target course and versions, append a migration audit record, change the enrollment pin, and create a new versioned plan. Old plans and lesson/evidence versions stay fixed. This workflow is deliberately blocked today; founder decisions on approval and reassessment belong before activation.

## Seed and migrations

The five existing Grade 8 skills keep their original IDs. `supabase/fixtures/grade-8.json` is the representative public document; the SQL seed contains its initial immutable snapshot and five separate private questions with deterministic question IDs. Running the seed repeatedly does not create new rows or overwrite publications; `npm run db:test:seed` runs it twice in a rolled-back transaction. Unit tests require fixture/seed/schema agreement. Updating the example fixture requires deliberately updating its seed literal; editing real published content uses a new draft/version.

Earlier migrations are preserved. The additive Phase 2 migration enables Supabase's [pg_jsonschema extension](https://supabase.com/docs/guides/database/extensions/pg_jsonschema) to enforce the same strict document shape in PostgreSQL. If a different installation already has unversioned enrollments, stop and prepare a reviewed legacy snapshot/backfill migration before applying this one. Never reset hosted data or assume today's content represents past learning requirements.

**Phase 3 implementation:** Enrollment, initial skill state, plans, schedules and persisted roadmap now consume the exact selected publication. See [Student course planning](STUDENT_COURSE_PLANNING.md). The future controlled publication-transition and Maya contracts remain unimplemented.
