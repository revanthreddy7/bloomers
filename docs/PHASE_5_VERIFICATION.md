# Phase 5 verification report

Verified October 11, 2026, against Phase 4 commit `41988f1`. Work is local. No push, public deployment, hosted project, paid service, external AI call, media capture, independent student login or Phase 6 workflow was performed.

## 1. What was built

An explicitly supervised local classroom rehearsal for an authorized selected student and canonical scheduled lesson. It shows Maya's inactive identity/conversation area, exact course/topic/objectives and publication/plan versions, reservation time/duration, lifecycle state and elapsed wall time. Parents enter through the existing student preview, start, draw, pause/resume/end, refresh/recover and explicitly return to parent mode.

The shared SVG whiteboard persists compact normalized operations through the canonical ordered lesson-event stream. Authenticated HTTP polling/replay is functional. WebRTC voice, Maya commands and synchronized teaching have typed/tested future contracts only. Rehearsals never create attendance, outcomes, mastery, homework or schedule changes.

## 2. Files and components changed

- `features/classroom/`: strict student/event/proposal schemas, frozen command JSON Schema, normalization, ordered replay, whiteboard reducer, future Maya scene application and audio/playback/interruption contracts, HTTP/local replay transports and disabled capability states.
- `server/classroom/service.ts`: selected-preview authorization, pinned canonical context, bounded replay and curated narrow mutation services.
- `components/classroom/classroom.tsx`: responsive lesson room, pointer/touch whiteboard, confirmed clear/end, lifecycle controls, recovery/retry, heartbeat, operational timeline and visible inactive media/upload controls.
- `app/preview/[id]/classroom/[scheduleId]/`: protected dynamic page and origin-checked, bounded JSON event endpoint. Existing preview middleware/layout/error/loading handling is reused.
- Application learning links, attendance read projection and view model: classroom entry and explicit exclusion of rehearsal attendance.
- `supabase/migrations/202610110007_classroom.sql`, regenerated database types, classroom unit/service/SQL/browser tests.
- README, classroom infrastructure/protocol/security documentation, ADR 0010 and this report.
- The existing uncommitted parent-email follow-up is retained: local verification screens link to Mailpit and explain resending. Production HTTP and original signup/email tests exercise it.

## 3. Database changes

The seventh additive migration extends existing `lessons`, `lesson_events` and private session-preview scope. Public domain tables remain 43. Earlier migrations and seed are unchanged; there is no competing lesson, reservation or drawing store.

Rehearsals carry an explicit mode, exact curriculum publication pin, sequence, interruption epoch and last-seen timestamp. Unique indexes enforce one rehearsal per reservation and one open rehearsal per student. New operations derive the verified canonical parent and real owned signed Auth session, require the selected preview and live relationship, and serialize on session/student locks. A different Auth session cannot mutate the open classroom. Parent controls and general learning writes remain denied.

Lifecycle validates readiness/start, pause, resume, end and abandonment. Ready/start commit together. Exact request retries resolve their original result; state-target retries are no-ops. Changed request reuse, invalid transitions, cancelled/stale reservations and stale command epochs fail. Future scheduled reservations may be rehearsed early; this is not live attendance eligibility. Ended/abandoned rehearsals are terminal through the scoped operations.

Drawing commands validate against the frozen JSON Schema, target scope/visibility, size and rate/history bounds. Sequences are allocated transactionally. Replay projects only protocol fields in pages of 250 and locks the lesson for a consistent state/event snapshot. Raw REST event access stays denied. Event source and parent actor attribution are assigned by the database, not the client. `student_preview` identifies supervised interaction, not independent student authentication.

Rehearsal identity/publication cannot be reclassified, and stored classroom events cannot be rewritten/deleted even by ordinary trusted writes. No normal service-role bypass is used. Final bounds reserve closure capacity: 60 student commands/minute, 30 changing nonterminal lifecycle operations/minute, and a 2,990-position threshold for appends/nonterminal transitions. End and abandonment can still complete at rate/history limits; the underlying stream is bounded to 3,000 entries.

Visible pages heartbeat every 30 seconds. Fifteen minutes of inactivity is reconciled on the next heartbeat, action or competing start. Explicit preview exit atomically abandons unfinished rehearsal state. No background cleanup job or automatic attendance inference exists.

## 4. Tests added

37 new unit/service tests cover normalized coordinates, stroke serialization, duplicate/out-of-order delivery and gaps, conflicting/mixed-lesson replay, undo/redo/eraser/clear, confirmation, bounds and strict fields, frozen schema/database agreement, preview attendance exclusion, future protocol versions/actions/proposals, playback references, interruption cancellation, stale instruction rejection, deterministic scene/mock transport, disabled media, scoped authorization, reservation ownership, curated errors and refusal to acknowledge work after abandonment.

75 new transactional PostgreSQL assertions cover real execution privileges, preview-only start, real session/relationship requirements, cancellation/expiry/guessed reservations, transitions/retries, conflicting rooms, parent/private-answer/event isolation, denied direct writes, strict drawing payloads/size/targets, stale epochs, recovery, independent session denial, event and lifecycle rate limits, reserved terminal capacity, end/abandonment, unchanged reservations/evidence, audits, immutable classification/pins/events and cross-family/student/admin denial. Capacity checks deliberately simulate a full counter within the rolled-back fixture transaction.

Two new real browser/API scenarios cover supervised entry, mouse and actual touch drawing, undo/redo/eraser, cancelled/confirmed clear, refresh replay, pause/resume/end, 390px layout, offline recovery, safe parent return, zero media-capture calls, unchanged reservations/unassessed skills, private HTTP responses, denied origins/oversized HTTP bodies, concurrent duplicate starts, conflicting rooms, foreign/forged/stale operations and explicit-return abandonment. All nine earlier browser scenarios and all earlier test files remain unchanged.

## 5. Actual results

| Check                           | Result                                                                                                                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                 | PASS: TypeScript, ESLint zero warnings, formatting and 185 unit/service tests across 16 files                                                                                                                                                |
| Local `db:reset`                | PASS: all seven migrations and seed applied                                                                                                                                                                                                  |
| `npm run db:lint`               | PASS: no public-schema warnings/errors                                                                                                                                                                                                       |
| `npm run db:test` on clean seed | PASS: 473 assertions (398 preserved + 75 Phase 5) across six files                                                                                                                                                                           |
| `npm run db:test:seed`          | PASS: two executions preserve catalog/private questions/publications/audit fingerprints; transaction rolled back                                                                                                                             |
| Full development browser suite  | PASS: all 11 scenarios on the final closure-safe implementation (53.3s)                                                                                                                                                                      |
| Production build                | PASS: final closure-safe production rebuild includes dynamic classroom and event routes                                                                                                                                                      |
| Production HTTP                 | PASS: home, health, sign-in and verify-email 200; parent, preview return, classroom and event routes redirect anonymous requests with 307 and private/no-store headers; local inbox guidance present                                         |
| Full production browser suite   | PASS: all 11 scenarios on the final closure-safe implementation (32.6s), including desktop/mobile classroom, refresh/return and all nine preserved scenarios                                                                                 |
| Visual review                   | PASS: synthetic desktop and 390px classroom screenshots inspected locally; no credentials or real child data captured                                                                                                                        |
| Production dependency audit     | PASS: zero vulnerabilities                                                                                                                                                                                                                   |
| Full dependency audit           | Known limitation: five high development-only findings in the inherited Next ESLint → fast-glob → micromatch → braces chain; suggested fix downgrades framework configuration                                                                 |
| Environment/dependency review   | Direct pinned versions match; package/lockfile unchanged. Node 24.12.0/npm 11.6.2 locally; configured Node 22 target not tested locally. Two existing extraneous optional installation remnants: `@emnapi/wasi-threads`, `@img/sharp-wasm32` |
| Compatibility                   | Earlier migrations/seed and all earlier unit, SQL and browser test files unchanged; original checks pass. Remote GitHub CI not executed                                                                                                      |

Implementation checks first found a future-command Zod tuple inference error and an unused SQL variable; both were corrected. The initial SQL run failed three drawing assertions because synthetic UUIDs did not match the strict protocol UUID format, with a consequent rate-count failure; corrected fixtures pass. The first full browser run passed nine preserved scenarios and one new scenario, but its drawing test addressed an offscreen board after Start; explicit viewport positioning corrected the test and the reruns passed. No failed run is counted as a pass.

The first full production run passed ten scenarios but the preserved enrollment browser scenario timed out after 15 seconds with its action pending. One unchanged targeted retry also timed out. A temporary timing/status-only diagnostic run then passed in 3.8 seconds, and the subsequent unchanged full suite passed in 32.4 seconds. The diagnostic captured no credentials/request bodies and was removed. No definitive cause was established; this intermittent symptom also appeared in the Phase 3 report and remains a limitation. The production classroom scenarios passed in each production run.

A final review added consistent replay locking and reserved closure capacity so event limits cannot block End/Return; explicit SQL tests pass. Final verification was repeated for these changes: 185 unit/service tests, 473 SQL assertions, seed replay, all 11 development scenarios (53.3s), production rebuild, HTTP checks and all 11 production scenarios (32.6s) passed. A status-property typo in the final HTTP check script caused that script to fail once; it was corrected and the complete HTTP rerun passed. Audit initially failed inside the sandbox because npm registry DNS was unavailable; the permitted network run passed production audit and confirmed the development findings above. No forced audit downgrade was applied.

Database suites ran on clean seed before browser fixtures. Type generation/build and browser development servers were sequential. Browser tests create synthetic local accounts/students/drafts/reservations, so reset before repeating global-count SQL suites. Actual local keys remain ignored, unprinted and uncommitted. The local environment remains a development/test installation.

## 6. How to test the classroom

Start Docker/local Supabase, configure actual ignored `.env.local` keys, then run `npm run dev` or build/use `npm start`. Open <http://localhost:3000>. Create/sign in as a verified parent; local verification mail is at <http://localhost:54324>. Choose or create a student and use the preserved enrollment workflow to schedule a future course lesson.

Choose **Open student preview**, then **Open supervised classroom preview** for an upcoming reservation. Confirm the supervised label, inactive Maya, pinned course/topic/objectives, lesson position, versions and scheduled time/duration. Choose **Start classroom preview**. Draw, undo/redo, select a stroke with Eraser, and cancel/confirm Clear. Refresh to recover saved work.

Pause and confirm drawing is disabled. Resume and draw again. Temporarily disconnect/reconnect to observe disabled drawing and ordered recovery. End with confirmation: the rehearsal becomes read-only and retains its board after refresh. Choose **Return to parent mode**, then **I’m the parent — continue**. An unfinished rehearsal is abandoned by explicit return. Parent attendance remains unchanged and skills remain unassessed.

Keep the guardian present. This is supervised practice using parent credentials, not a secure unattended device handoff. Its Return confirmation does not authenticate the person pressing it. Use a different upcoming reservation for a new rehearsal after End/Abandon; a terminal rehearsal cannot restart on the same reservation.

## 7. Whiteboard capabilities

Functional pen, whole-stroke eraser, undo/redo, confirmed clear, compact normalized points, fixed dark UI pen, mouse/pointer/touch input, ordered persistence, deterministic replay and refresh recovery. The wire schema supports three bounded colors and widths, while UI currently exposes one pen style. Clear resets redo history; earlier commands remain in the immutable timeline. Work is saved after pointer completion, not continuously as an image. Unsaved/in-progress strokes are cancelled on interruption.

Future Maya text/math/line/shape/graph/highlight/point/erase/clear proposals have runtime schemas and deterministic scene application tests. They are not accepted by the student RPC, generated by a model or rendered as active tutoring today.

## 8. Realtime readiness

Authenticated two-second polling, bounded incremental replay, state recovery, idempotent uncertain-write retry, a real HTTP transport and deterministic local mock transport are implemented. Future WebRTC voice is an interface only; no external connection/credential is issued.

The unified timeline contract binds future visuals to speech IDs and acknowledged playback start/offset/end anchors. Epoch changes discard queued visuals after interruption and stale proposals fail validation. Tool arrival does not imply exact audio/visual synchronization. Phase 6 must supply approved producers, playback clocks, rendering, delivery/interrupt recovery and capability gates. Future question/answer/hint/misconception/evidence/media events are strict reference-only proposals, not fabricated records.

## 9. Known limitations

This is a small five-skill curriculum and a single intended supervised rehearsal, with polling latency, bounded history and pointer/touch drawing. There is no collaborative multi-user classroom, offline drawing merge, full-screen board, live chat, active Maya, independent student Auth, unattended handoff or guardian reauthentication. Undo hides the newest visible stroke and Redo restores the newest hidden stroke by original drawing order, including erased strokes. This is not an arbitrary operation-level undo stack; clear cannot itself be undone. The board is not a full equation/graph editor.

Future reservations can be rehearsed early; final live start/attendance eligibility is not activated. Ended/abandoned rehearsals cannot restart. Inactivity is lazy reconciliation, not automatic background expiry. There is no retention/deletion/archival UI or cleanup worker; future reviewed deletion may require database-definition changes because event history is immutable. Wall-clock elapsed includes pauses. Existing legacy incomplete enrollments require reviewed initialization.

The two production enrollment timeouts, development-only dependency findings, two optional installation remnants and untested Node 22 target remain recorded. No model, media, upload, assessment, homework, notification or adaptive-scheduling workflow is enabled. Evidence and dates are not inferred from rehearsal activity.

## 10. Security and privacy notes

Server Auth/RLS and PostgreSQL independently authorize the selected student, real session and relationship. No client role/parent/source identifier is trusted. Scoped classroom mutations extend preview narrowly; parent account/consent operations, unrelated students, private answers, raw events and privileged learning writes stay denied. An independent session cannot commandeer an active classroom. Request origin, format, payload size, schema, ordering, epoch and storage/event rate bounds are enforced.

Classroom props expose no parent email/session/token, sibling profiles, internal prompts, answer keys or raw evidence payload. Routine services use authenticated clients without service-role bypass. Drawing/event content is not added to application logs. Disabled controls never call media-capture APIs; the browser capture spy records zero calls. No upload route, bucket, file input, background surveillance or recording is introduced. Synthetic privileged fixtures are restricted to local hosts and not committed as accounts/keys.

The supervised credential/return limitations from Phase 4 remain explicit. Future voice, camera, uploads, AI, separate student access and safe handoff require reviewed capability/eligibility/privacy controls; these contracts do not activate them.

## 11. Next phase

Phase 6: reviewed Maya tutoring integration, lesson-context/planning and WebRTC voice coordinated with the validated classroom event timeline. It was not started. Assessment/mastery remains Phase 7, homework continuity Phase 8 and adaptive recalculation Phase 9.
