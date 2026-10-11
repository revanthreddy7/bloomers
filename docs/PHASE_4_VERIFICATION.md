# Phase 4 verification report

Verified October 10, 2026, against Phase 3 commit `c87b2e6`. Work is local. No push, deployment, hosted project, paid service, external AI call, independent student login or Phase 5 workflow was performed.

## 1. What was built

A cohesive parent application with Overview, Course, Progress, Homework, Schedule and Settings; a consistent authorized student selector; responsive desktop/sidebar and mobile navigation; and a clearly labeled parent-assisted student preview with Home, Course, Homework and Progress. Existing student profiles, consent decisions, enrollment and detailed roadmap links remain available.

Dashboards show persisted enrollments, exact curriculum/plan versions, planned objectives, canonical lesson reservations, estimated completion, recorded session metadata, skill evidence references and homework metadata. Newly enrolled skills remain Not yet assessed. There are no invented attendance results, mastery percentages, homework assignments, attention recommendations or AI insights.

## 2. Files and components changed

- `features/application/models.ts`: typed academic, progress, homework, attendance, timezone and weekly schedule view models.
- `server/application/`: bounded authenticated read services, explicit preview entry/exit actions and preview authorization.
- `components/application/`: shared learning views and parent/preview navigation.
- `app/parent/`: existing shell/home integration and student-specific learning routes. `app/preview/`: isolated learning layout, routes, return confirmation, loading and error states.
- Existing identity and roadmap services: preview restrictions, publication-scoped skill reads and bounded plan-item pagination. Middleware: preview protection, explicit anonymous redirects and private/no-store headers. Shared styles: calm tokens, accessible focus/touch targets, responsive navigation and panels.
- `supabase/migrations/202610100006_application_shell.sql`, regenerated database types, new SQL/unit/service/browser tests.
- README, application/navigation/data-contract documentation, ADR 0009 with architecture diagram, ADR 0008 follow-up and this report.

## 3. Database changes

One additive migration creates `private.parent_student_previews`, with RLS and no browser schema/table privileges. Public domain tables remain 43; enrollment, skills, plans, homework and schedules have no competing storage representation. Earlier migrations and seed are unchanged.

Explicit entry binds a verified canonical parent, authorized student and real signed Auth session identifier. The existing ownership helper narrows student and nested reads to that selected student. Restrictive policies hide parent identity/profile, consent and parent-report records. A preview publication policy permits only exact published enrollment pins. The parent mutation gate rejects active preview sessions; entry/exit and parent mutations serialize on the same session lock. Both transitions are audited with identifiers. Direct privileged writes remain denied.

An explicit exit restores parent mode for that session. Independent parent sessions are unaffected. Relationship revocation removes student read access without silently restoring parent mode. Preview state persists through refresh and is retained when Auth sessions are removed, preventing an already-issued preview JWT from regaining parent mutation access merely through session deletion. Operational cleanup is future reviewed work. Existing consent restrictions and publication immutability remain intact.

## 4. Tests added

35 unit/service tests cover pinned course hierarchy, evidence versus unassessed state, refusal to infer mastery, correct evidence references, homework empty/recorded/partial states, real attendance, timezone date boundaries, DST offset labels, local weekly membership, bounded week navigation, upcoming statuses, authorized selected-student reads, preview entry/scope requirements, parent route escape denial, consistent delegated roadmap context and bounded selectors/services.

41 new transactional SQL assertions test real grants/RLS, session ownership, verified parent identity, foreign/sibling isolation, canonical schedules/skills/homework, exact publication reads, hidden real consent/report records, private answers, denied parent and learning mutations, explicit return, independent sessions, audit uniqueness and relationship revocation. All prior SQL test files remain unchanged.

Two browser/API scenarios verify parent overview, two-student switching, every learning view, stable roadmap links, timezone-aware weeks, refresh persistence, restricted preview navigation, direct REST/RPC denial, safe return, anonymous/foreign/guessed routes, private headers and 390px mobile layouts. The production run additionally verifies browser-back escape protection. All seven prior browser scenarios remain unchanged and pass.

## 5. Actual results

| Check                                  | Result                                                                                                                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                        | PASS: TypeScript, ESLint zero warnings, Prettier, 148 unit/service tests across 14 files                                                                                                                                                       |
| Local `db:reset`                       | PASS: all six incremental migrations and seed applied                                                                                                                                                                                          |
| `npm run db:lint`                      | PASS: no public-schema warnings/errors                                                                                                                                                                                                         |
| `npm run db:test` on clean seed        | PASS: 398 assertions across five files (357 preserved + 41 Phase 4)                                                                                                                                                                            |
| `npm run db:test:seed`                 | PASS: two seed executions preserve catalog, private questions, publications and audit fingerprints; rolled back                                                                                                                                |
| `npm run test:e2e`                     | PASS: all nine real browser/API scenarios, including seven preserved scenarios (40.0s)                                                                                                                                                         |
| `npm run build`                        | PASS: production build including parent learning views and isolated preview routes                                                                                                                                                             |
| Production HTTP                        | PASS: home, health and sign-in 200; parent/settings/learning, preview/return and curriculum redirect anonymous requests with 307; protected responses private/no-store                                                                         |
| Production authenticated shell/preview | PASS: both Phase 4 browser scenarios against `npm start`, including browser-back escape protection, refresh, scoped RPCs and mobile navigation (12.0s)                                                                                         |
| Production dependency audit            | PASS: zero vulnerabilities                                                                                                                                                                                                                     |
| Full dependency audit                  | Known limitation: five high development-only findings in the inherited Next ESLint → fast-glob → micromatch → braces chain; npm suggests a breaking framework-config downgrade                                                                 |
| Dependency/environment inspection      | All direct dependencies match pinned versions. Node 24.12.0/npm 11.6.2 locally; configured Node 22 development/CI target not tested locally. Two extraneous optional installation remnants remain: `@emnapi/wasi-threads`, `@img/sharp-wasm32` |
| Compatibility review                   | All previous migrations and unit/SQL/browser test files unchanged. Prior functionality passes. Package and lockfile unchanged                                                                                                                  |

Implementation runs found and corrected a new fixture's skill-name mismatch, an authentication mock compatibility issue, duplicate overview headings affecting a preserved browser locator, a student-switch test navigation race, an anonymous streamed redirect returning HTTP 200, week/date assumptions and text-content comparison in the new browser test, and the preview publication RLS issue caused by hiding the parent role row. A type-generation run overlapping the browser dev server also failed because both wrote `.next`; a sequential application-check rerun passed. Final results above are corrected executed runs; earlier failures are not counted as passes.

Database checks ran after clean reset and before final browser fixtures. Type checks/build and browser dev servers were sequential for the final checks. Browser tests intentionally create synthetic local accounts/student records; reset before repeating global-count database assertions. No GitHub-hosted CI run was observed. No dependency versions were changed, no forced audit downgrade was applied, and local keys remained ignored and unprinted.

## 6. How to test the parent application

Start Docker/local Supabase and configure actual ignored `.env.local` keys. Run `npm run dev`, or build and use `npm start`, then open <http://localhost:3000>. Sign in as a verified parent. Existing parent accounts, profiles and enrollments remain usable. Add/select a student if needed and enroll through the preserved Phase 3 workflow.

Use **Selected student** to switch between authorized profiles. Open Overview, Course, Progress, Homework and Schedule. Confirm a different student has their own enrollment/empty state, and refresh retains the selected URL and persisted dates. Open the detailed roadmap from Course. Schedule supports previous/current/next weeks, timezone labels and actual reserved duration. Progress shows five Not yet assessed skills for a fresh Grade 8 enrollment; Homework has no assignments until actual records exist. Settings and profile permissions remain parent-only.

## 7. How to test the student preview

From a selected student's overview, choose **Open student preview**. Confirm the banner explicitly says **Parent-assisted student preview** and navigation contains Home, Course, Homework and Progress, without sibling selection, parent account details, consent or administrative controls. Home links to the same canonical weekly schedule. Refresh keeps the same student and records.

Navigating to parent settings or another student's parent view returns to the selected preview. A sibling/foreign preview URL is unavailable. Direct parent mutation RPCs reject the preview session. Choose **Return to parent mode**, then **I’m the parent — continue**; the same student's parent overview opens, and student switching becomes available again.

Keep the parent present. This is supervised viewing, not independent student authentication or a secure unattended device handoff. Close other parent tabs before preview. Its explicit return button is not guardian reauthentication.

## 8. Known limitations

The Grade 8 curriculum is a small representative prototype. Dashboards are read-only summaries, with at most 50 selector profiles, 10 loaded enrollments, 50 assignments, 200 submissions, 50 recent session records, 100 week reservations and 10 upcoming reservations. Partial reads are labeled. Full-history pagination is not implemented. Weekly display uses the first loaded course's timezone, or explicitly labeled UTC if none exists; canonical start/end instants remain unchanged.

Evidence presence and aggregate scores do not prove the pinned publication's assessment requirements, so no Mastered/Needs review/Currently learning classification is manufactured. Homework in-progress tracking and content workflows are absent. Attendance is recorded session metadata, not an inferred conclusion from a reservation. All completion and dates remain estimates. Legacy incomplete enrollments require reviewed initialization.

Preview retains parent Auth credentials and is session-specific. It does not constrain Supabase Auth's own account/session APIs or authenticate the person pressing Return. Already rendered parent tabs can hold earlier data. Future secure handoff needs approved separate limited credentials, expiry/revocation, removal of parent credentials, guardian-return authentication and consent/eligibility decisions. Private preview-state cleanup needs a reviewed operational policy.

No classroom, join action, voice, camera, upload, avatar, external AI, assessment/mastery workflow, homework creation/submission, notifications, analytics or adaptive recalculation is enabled. Existing development audit findings and the untested local Node 22 target remain recorded above.

## 9. Security and privacy

Server Auth validation and PostgreSQL repeat student/session/relationship checks. Selected URL parameters and the client selector cannot authorize data. Preview scope is private database state bound to the signed parent session, not a caller-controlled cookie marker. Reads remain behind RLS; direct parent identity, enrollment and consent mutations reject active preview sessions. Direct learning writes stay denied. Parent account/consent/report records and unrelated students are hidden; only pinned published academic documents are opened for preview.

No routine service-role bypass is used. Shared read services request bounded metadata and evidence references rather than raw evidence payloads, private answers, transcripts or AI insights. Preview client components receive no parent tokens, session objects, account email or sibling profiles. Test credentials are local guarded fixtures only, unprinted and uncommitted. Sensitive routes use private/no-store/no-referrer handling. Existing draft consent grants remain inactive; no child media or unnecessary tracking is introduced.

The supervised-preview limitation above is deliberate and visible. Independent student authentication and secure unattended handoff remain separate founder-approved future designs.

## 10. Next phase

Phase 5: Classroom, following the original build brief. It was not started. Maya remains Phase 6, assessment/mastery Phase 7, homework continuity Phase 8 and adaptive scheduling Phase 9.
