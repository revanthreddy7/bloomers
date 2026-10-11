# Phase 3 verification report

Verified October 10, 2026, against Phase 2 commit `b55520f`. All work is local. No push, public deployment, hosted project, paid service, external AI call, Phase 4 workflow or Maya integration was performed.

## 1. What was built

An authenticated parent can enroll an existing authorized student in an explicitly selected published course version, provide initial availability, and return to a persistent personalized roadmap. Enrollment atomically creates unknown/unassessed skill state, a prerequisite-correct instructional plan, timezone-aware canonical reservations and audit records. Duplicate and competing requests resolve the same initialized enrollment. Failures leave no partial course.

The five Grade 8 Mathematics skills total 120 estimated instructional minutes. With 30-minute lessons the initial planner produces four lessons and seven ordered skill segments. These are estimates, without inferred mastery or fabricated learning progress.

## 2. Files and components changed

- `features/planning/`: strict preferences and frozen JSON Schema, deterministic academic planner, calendar scheduler, and future personalization contracts.
- `server/planning/`: parent-authorized enrollment action and persisted roadmap retrieval using authenticated clients.
- `components/planning/enrollment-form.tsx`, new parent student course routes, existing student profile navigation, and responsive styles.
- `supabase/migrations/202610100005_planning.sql` and regenerated `types/database.ts`.
- Planning unit/action tests, transactional SQL tests and two real browser/API scenarios.
- README, ADR 0008 with an architecture diagram, Phase 2 documentation follow-ups, `STUDENT_COURSE_PLANNING.md`, and this report.

## 3. Database changes

The fifth additive migration reuses the existing enrollment, student-skill, availability, plan, item, schedule and change tables; the public table count remains 43. Earlier migrations are unchanged.

Enrollment records gain actor/request metadata, explicit initialization state and status. Plans/items gain algorithm/status, lesson positions, objectives and instructional minutes. Reservations gain UTC ends, timezone and plan/lesson references. Composite references validate reservation ownership and item membership in the pinned publication. A range exclusion constraint prevents overlapping non-cancelled reservations for the same student, including concurrent writes; touching endpoints are permitted.

The scoped `enroll_parent_student` RPC derives the verified canonical PARENT actor from JWT identity, validates the relationship and publication, serializes student mutations, checks idempotency, then performs all initialization within one transaction. Its internal planner and scheduler are inaccessible to browser roles. Preferences are validated in both application and database. Direct privileged table writes remain denied. Initial schedule-change and enrollment audit records contain identifiers and operational metadata.

Publication pins are never advanced automatically. A later published version leaves existing enrollment, historical plan and reservations unchanged. Conflicting retry preferences or publication choices return an error. Existing legacy enrollments remain explicitly legacy and require reviewed initialization. Legacy schedules lacked end times; migration uses a documented 30-minute duration and fails if existing reservations overlap rather than changing their starts silently.

## 4. Tests added

33 unit/action tests cover academic ordering, prerequisite sequencing, stable positions, deterministic lesson splitting, scope/cycle rejection, objectives, duration bounds, preference validation/schema agreement, weekly recurrence, local-day boundaries, projected completion, UTC duration, half-open overlaps, ordinary and half-hour DST transitions, fractional offsets, authorization, curated errors and past-date idempotent retries.

61 transactional PostgreSQL assertions cover real execution privileges and RLS, verified parent authorization, canonical role checks, complete unknown skill initialization, genuine evidence preservation, exact published pins, draft rejection, duplicate requests, persisted plan/schedule consistency, overlapping schedule rollback, cross-family and student isolation, privileged mutation denial, timezone/DST behavior and audit uniqueness.

Two browser/API scenarios exercise the complete parent workflow, refresh and return navigation, a 390px viewport, unauthorized URL pairs, real competing requests, canonical record counts and atomic conflict rollback. All earlier unit, SQL and browser test files remain unchanged.

## 5. Actual results

| Check                             | Result                                                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                   | PASS: TypeScript, ESLint zero warnings, formatting, 113 unit/service tests across 11 files                                                                                                                                                 |
| Local `db:reset`                  | PASS: all five incremental migrations and seed applied                                                                                                                                                                                     |
| `npm run db:lint`                 | PASS: no schema warnings/errors                                                                                                                                                                                                            |
| `npm run db:test` on clean seed   | PASS: 357 assertions (201 Phase 0 + 47 Phase 1 + 48 Phase 2 + 61 Phase 3)                                                                                                                                                                  |
| `npm run db:test:seed`            | PASS: two seed executions preserve catalog, private questions, publications and audits; transaction rolled back                                                                                                                            |
| `npm run test:e2e`                | PASS: all seven real browser/API scenarios, including all five preserved scenarios (25.0s)                                                                                                                                                 |
| `npm run build`                   | PASS: production build including enrollment and roadmap dynamic routes                                                                                                                                                                     |
| Production HTTP                   | PASS: home, health and sign-in return 200; parent, curriculum, enrollment and roadmap redirect unauthenticated requests with 307; protected responses private/no-store                                                                     |
| Production authenticated workflow | PASS on rerun: parent enrollment, persisted roadmap, refresh, mobile layout, family isolation and return navigation against `npm start` (3.7s)                                                                                             |
| Production dependency audit       | PASS: zero vulnerabilities                                                                                                                                                                                                                 |
| Full dependency audit             | Known limitation: five high development-only findings in the existing Next ESLint → fast-glob → micromatch → braces chain; suggested remediation is a breaking framework-config downgrade                                                  |
| Dependency/environment inspection | Direct dependencies match pinned versions. Node 24.12.0/npm 11.6.2 locally; configured Node 22 development/CI target not tested locally. Two extraneous optional installation remnants remain: `@emnapi/wasi-threads`, `@img/sharp-wasm32` |
| Compatibility review              | Earlier migrations and every Phase 0/1/2 test file unchanged; all original tests pass                                                                                                                                                      |

The first targeted production browser attempt timed out after 15 seconds while the enrollment action was pending. An unchanged rerun passed in 3.7 seconds; this report does not present the failed attempt as a pass. Implementation-time SQL lint findings were corrected before the successful clean reset/lint/database run. Calendar validation was moved behind the database idempotency check so an old retry can resolve its existing roadmap after its original start date passes.

Database assertions ran after a clean reset and before browser fixtures. Browser scenarios create synthetic local accounts/students/reservations; reset before repeating the global-count database suites. Build and browser development servers were run sequentially. Remote GitHub CI was not executed. No dependency versions were changed or forced audit downgrade applied. Actual local keys were consumed without printing or committing them.

## 6. How to test enrollment and roadmap

Start Docker/local Supabase, configure actual Git-ignored `.env.local` keys, and run `npm run dev`, or build and use `npm start`. Open <http://localhost:3000>, sign in as a verified parent, choose an existing student, and select **Enroll in a course**. Choose **Grade 8 Mathematics · Version 1**, enter your timezone, duration/frequency, exactly that many weekdays, a preferred local time and an earliest starting date. Confirm enrollment.

Inspect the student-specific curriculum/plan versions, Not started plan, five Not yet assessed skills, prerequisites, four projected lessons for the 30-minute default, upcoming reservations and estimated completion. Refresh, return to the profile and choose **View course roadmap**: identifiers and dates persist. Another family's student/enrollment URL pair returns 404. A scheduling conflict displays an actionable error without creating a partial enrollment.

For a full verification run, stop other app servers, reset only the selected local development database, run SQL checks and seed replay first, then browser tests. Never build concurrently with Playwright's development server because both use `.next`.

## 7. Known limitations

The curriculum is a representative five-skill prototype. Initial planning schedules all required instructional estimates and does not accelerate from previous evidence. UI preferences use one common local time across chosen weekdays; the underlying contract supports a time per weekday. No vacation exceptions, cancellation, initial schedule editing, curriculum migration, calendar UI or notifications are implemented.

Durations are 20–90 minutes, frequency 1–7/week, first date today through the next 365 local days, with at most 200 lessons in a 730-day horizon. A nonexistent or ambiguous local time rejects enrollment; a conflicting reservation rejects the complete operation. Parents must explicitly choose availability. Existing legacy enrollments need reviewed initialization, and legacy reservation duration defaults to 30 minutes.

No diagnostic assessment, evidence-based mastery update, homework, classroom session, student sign-in, full parent dashboard, Maya/LLM integration or adaptive scheduling is activated. Completion and dates remain estimates. The initial production browser timeout and existing development dependency findings are recorded above.

## 8. Security and privacy

Authenticated server services and PostgreSQL independently authorize the canonical actor and student relationship. No browser-provided parent ID, role, publication status, mastery, plan or UTC schedule is trusted. Parents and students cannot directly alter privileged learning state. Cross-family records remain hidden through existing RLS, and parent-only operations reject student/admin impersonation. Routine workflows use authenticated clients, without service-role bypass.

New zero scores have zero confidence/evidence and explicit unassessed state; no diagnostic result is invented. Existing genuine skill evidence remains unchanged. Audit metadata contains operational identifiers rather than child names or answers. Existing consent gates and inactive AI, microphone, camera and upload restrictions remain intact. Privileged test fixtures are guarded to local hosts; keys stay Git-ignored.

## 9. Next phase

Phase 4: Application Shell, following the original build brief. It was not started. Later Maya lesson planning can consume the pinned curriculum, persisted course plan, canonical schedule and validated student evidence contracts. Full adaptive recalculation remains Phase 9.
