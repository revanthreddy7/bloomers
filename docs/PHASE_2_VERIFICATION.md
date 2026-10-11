# Phase 2 verification report

Verified October 10, 2026, against Phase 1 commit `773188d`. Work is local. No push, deployment, hosted project, paid service, AI call, or Phase 3 workflow was performed.

## 1. What was built

A typed, versioned curriculum engine for Course → Unit → Topic → Skill; strict academic metadata and structured chapter content; deterministic ordering and version-scoped prerequisite DAGs; trusted draft save/publication operations; immutable publications; fixed enrollment and historical course-plan references; and an authenticated read-only Curriculum Explorer. Existing academic IDs and the five Grade 8 skills are preserved.

## 2. Files and components changed

- `features/curriculum/`: Zod document/content/skill schemas, frozen JSON Schema, ordering/graph/readiness logic, and future consumer contracts.
- `server/curriculum/`: Auth/canonical-role checks and server-only read/draft/publication services.
- `app/curriculum/`: listing, version-specific course exploration, authenticated layout, sign-out, loading and error views.
- Identity sign-in routing, parent navigation, and middleware: academic administrators reach the explorer; curriculum responses use private/no-store headers.
- `supabase/migrations/202610100004_curriculum.sql`, repeatable seed, representative fixture, and regenerated `types/database.ts`.
- Curriculum unit/service, SQL security/lifecycle, and real browser/concurrency tests; seed replay script and CI step.
- README, ADR 0007, Phase 0 authorization follow-up, curriculum schema/editor documentation, Maya Teaching Studio contract, and this report.

## 3. Database changes

The additive migration introduces `curriculum_versions` (43 public tables total), JSON Schema checks, structural/graph validation, identity registration/scope protection, immutable publication triggers, and publication audit records. Confirmed canonical ADMIN actors can invoke only the scoped draft-save and publication RPCs. Internal functions have explicit execution revocations; anonymous callers cannot author or read versions. Client direct table writes remain denied.

Draft-only stable identities are hidden by legacy catalog RLS. Parents see published documents; verified academic administrators can inspect drafts through internal services/RLS, while the explorer always filters publications. Private assessment questions/answers remain unreadable to browser roles. Published identities cannot be deleted/reassigned or have stable codes changed.

`student_courses` require a publication belonging to the same stable course; `course_plans` copy the enrollment pin. A new publication leaves both existing records unchanged. Pin changes are blocked pending a reviewed migration workflow. Existing unversioned enrollments cause a clear migration failure rather than fabricated history. Prior migrations are unchanged.

## 4. Tests added

32 unit/service tests cover the sample hierarchy/content, ordering, objective/readiness requirements, strict field rejection, mastery bounds, identity/position uniqueness, topic practice membership, frozen schema/seed agreement, direct/transitive prerequisites and dependents, deterministic topology, cycles/self edges/invalid scope/duplicate edges, reader/admin gates, spoofed roles, and sign-in routing.

48 new transactional PostgreSQL assertions cover real role privileges, draft creation/editing, stale revisions, publication readiness and retries, audit uniqueness, immutability, identity/course scope, draft-only catalog isolation, answer privacy, anonymous/student/parent/unverified-admin denial, and existing enrollment/historical-plan continuity across publication.

Two new browser/API scenarios verify published exploration and 390px layout, private answer isolation, denied parent authoring, admin sign-in, guessed draft URLs, and competing graph edits. Two individually valid edits would form a cycle if combined: one revision-checked save succeeds, one returns `40001`, and a combined cyclic document is rejected with `22023`. The seed replay check runs SQL twice inside a rolled-back Docker/PostgreSQL transaction and compares complete catalog, questions, version, and audit fingerprints.

## 5. Actual results

| Check                             | Result                                                                                                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                   | PASS: TypeScript, ESLint zero warnings, Prettier, 80 unit/service tests across nine files                                                                                                                                                                                |
| Local `db:reset`                  | PASS: all four incremental migrations and seed applied                                                                                                                                                                                                                   |
| `npm run db:lint`                 | PASS: no schema warnings/errors                                                                                                                                                                                                                                          |
| `npm run db:test` on clean seed   | PASS: 296 assertions (201 Phase 0 + 47 Phase 1 + 48 Phase 2)                                                                                                                                                                                                             |
| `npm run db:test:seed`            | PASS: two seed executions preserve catalog, private questions, publications and audits; rolled back                                                                                                                                                                      |
| `npm run test:e2e`                | PASS: all five real browser/API scenarios, including all three preserved Phase 1 flows (17.4s)                                                                                                                                                                           |
| `npm run build`                   | PASS: production build, including dynamic curriculum listing/detail routes                                                                                                                                                                                               |
| Production HTTP                   | PASS: `/`, health and sign-in return 200; parent/curriculum/detail redirect unauthenticated requests with 307 to sign-in; protected responses private/no-store                                                                                                           |
| Production authenticated explorer | PASS: targeted parent browser scenario against `npm start`, including content, 390px layout, privacy and 404 checks (3.0s)                                                                                                                                               |
| Production dependency audit       | PASS: zero vulnerabilities                                                                                                                                                                                                                                               |
| Full dependency audit             | Known limitation: five high development-only findings in the existing Next ESLint → fast-glob → micromatch → braces chain; npm suggests a breaking framework-config downgrade                                                                                            |
| Dependency/environment inspection | All direct dependencies match pinned versions; Node 24.12.0/npm 11.6.2 locally. Node 22 remains the configured development/CI target, not tested here. `npm ls` also reports two extraneous optional installation remnants (`@emnapi/wasi-threads`, `@img/sharp-wasm32`) |
| Compatibility review              | Earlier migrations and every Phase 0/1 test file unchanged; original unit, SQL and browser tests pass                                                                                                                                                                    |

Database tests assume a clean seed. Browser tests intentionally create synthetic local accounts/profiles and a draft; reset before rerunning the SQL suites because the preserved Phase 0 fixtures assert global row counts. An exploratory rerun after browser fixtures failed those count assumptions; the final clean reset and complete database run passed. Initial implementation runs also identified UUID-format compatibility, a SQL alias ambiguity, lint array casts, explicit execution grants, and a browser navigation race; these were corrected before final successful verification. No failed check is presented as a pass.

CI now includes seed replay. Remote GitHub CI was not executed. No dependency versions were changed, and no forced audit downgrade was applied. Local environment keys remain Git-ignored; actual keys are consumed by the real integration tests without printing or committing them.

## 6. Test the explorer

Start local Supabase/Docker, configure actual `.env.local` keys, then run `npm run dev` (or the built `npm start`). Sign in as a verified parent and choose **Curriculum**, or open http://localhost:3000/curriculum. Select Grade 8 Mathematics. Inspect version 1, Algebra → Linear Equations, the five skills, objectives, prerequisites, explanations, worked example, practice prompts, common mistakes, and whiteboard plan. Sign out to verify protected access.

Stop other app servers before the full browser suite. Never run `next build` concurrently with Playwright's dev server, since both use `.next`. Run database checks immediately after a local reset, then browser checks. Reset deletes only the selected local development database and its synthetic fixtures.

## 7. Known limitations

This is a small representative Grade 8 prototype, not a full curriculum. Draft editing replaces a bounded complete document rather than individual relational nodes. Database version deletion/archival is not enabled. Legacy catalog titles/metadata are compatibility records; new consumers must resolve snapshots through the versioned service. New learning-event/lesson workflows must explicitly capture their curriculum version when implemented.

No real administrator account is created. No complete Studio UI, uploads/ingestion, teaching-policy editor/activation, LLM integration, enrollment UI, scheduler, assessments, mastery updates, or student login is implemented. Teaching readiness checks validate required structure, not pedagogical correctness; future review remains necessary. Controlled student migration is a documented contract and is deliberately blocked at the database boundary today.

## 8. Security and privacy

Server Auth validation and confirmed canonical roles gate services; PostgreSQL repeats administrator checks and derives actors from JWT subjects. Editable metadata cannot promote a parent. No normal service uses service-role bypass. Privileged keys appear only in ignored local configuration and guarded local test fixtures. Curriculum mutation audit metadata contains version/revision identifiers, not child data. Public structured content has no private answer field or system-prompt field; worked teaching examples intentionally include solution steps.

Published rows remain immutable even for ordinary trusted service/database-owner writes. Owners could alter database definitions, so schema-change access remains an operational trust boundary. Existing child-data RLS, consent controls, logs and inactive capability restrictions remain intact.

## 9. Curriculum Studio readiness

Stable IDs, editable structured drafts, course-local reorganization, versioned graph/assessment requirements, optimistic revision conflicts, readiness validation, audited publication, version cloning/rollback strategy, and student continuity are established. The documentation describes preview/review, uploads, archival, and controlled migration work still needed before a full editor.

## 10. Maya Teaching Studio readiness

The conceptual contract separates global philosophy/communication, subject strategies, chapter academic guidance, relevant student evidence, and independent mandatory safety/authorization controls. It defines immutable policy versions, tested activation/rollback, exact session references, and a Lesson Context Package that future services must runtime-validate. Static contracts do not activate or authorize Maya; no teaching-policy or model integration is implemented.

## 11. Next phase

Phase 3: authorized StudentCourse enrollment, StudentSkill initialization, deterministic initial course plan/schedule, and roadmap UI using explicitly selected published versions. This phase was not started.
