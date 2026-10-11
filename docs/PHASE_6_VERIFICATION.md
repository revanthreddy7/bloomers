# Phase 6 verification report

Verified October 11, 2026, against Phase 5 commit `d8d51f5`. Work is local. No push, deployment, hosted project, paid AI activation, external model call, real microphone/camera capture, child pilot or Phase 7 workflow was performed.

## 1. What was built

A working, explicitly labeled Maya teaching simulation inside the existing supervised classroom. A parent-authorized rehearsal uses its exact published curriculum and planned skill, persists a strict deterministic teaching plan, displays narration alongside committed Maya whiteboard commands, asks an instructional question, offers a fixed alternative explanation and simulated learner response, handles interruptions, refresh/reconnection and safe termination. It remains a rehearsal without attendance, learning evidence, mastery, homework or schedule changes.

## 2. Files and components changed

- `features/maya/`: runtime context/plan/tool/policy contracts, reviewed scripts, deterministic planner, frozen event schema, narration/board replay, estimated-budget ledger and inactive WebRTC adapter.
- `server/maya/`: authorized context/orchestration, strict audited proposal tools, mock provider selection, server-only inactive OpenAI Realtime/structured-planning adapters and fail-closed configuration/activation gate.
- Existing classroom context, event route, client and styles: academic context available to server consumers, strictly bounded mock operations, simulated teaching controls and rendered Maya SVG commands.
- `supabase/migrations/202610110008_maya_mock.sql`, generated types, new unit/service, transactional SQL and browser/API tests.
- OpenAI SDK 7.32.0 pinned in package/lockfile; server-only configuration examples. Existing dependency versions unchanged.
- README, Maya integration/activation documentation, ADR 0011, relevant earlier-contract follow-ups and this report. Historical verification reports remain unchanged.

## 3. Database changes

One additive migration; public domain tables remain 43. Earlier migrations and seed are unchanged. Canonical `lessons` gain a bounded teaching cursor, pending speech reference, timing and stop markers. Existing `lesson_plans`, `lesson_events`, `ai_runs` and `tool_calls` store validated plans, ordered simulation events and operational provenance. No alternate classroom or learning store is created.

The scoped mock operation repeats confirmed canonical parent, owned real Auth session, selected preview, relationship, reservation and room-ownership checks. It serializes with existing lifecycle operations, derives its plan/actions independently from the pinned publication, checks epochs/speech IDs/timing/rate/history and deduplicates exact request UUIDs. Browser callers cannot supply narration, arbitrary board payloads, provider configuration, policy versions or actors.

Simulation plans are immutable; classroom history remains append-only and exact pins remain unchanged. Sources are explicitly `maya_mock`. Tool auditing stores bounded proposed/validated/rejected outcomes without raw arguments and cannot execute a tool. Stop retains closure capacity and works during pause/rate saturation; lesson End/Return clears pending teaching through the canonical lifecycle. Nothing promotes experiments into genuine attendance or evidence.

## 4. Tests added

49 new unit/service tests cover strict context/plan/tool schemas, deterministic script and frozen SQL agreement, correct published pins, evidence versus unassessed state, bounded homework/chapter context, no private-answer/history reads, server scope denial, curated errors, provider selection/configuration, missing keys and unauthorized activation, budget/duration failure, narration/board ordering, duplicates, stale generations and replay. Inactive voice tests use fake media/peer/fetch implementations to verify explicit permission, expiration, failure/timeout, interruption, validated proposals and track cleanup. No test contacts an AI provider.

76 new transactional PostgreSQL assertions cover real grants/roles, parent/foreign/independent-session denial, canonical scoped planning, retries, immutable plans/events, ordered speech/board references, early/stale acknowledgments, interruption and preservation of applied visuals, unknown-skill rejection, tool audits/rejections, rate/history/duration limits, stop while paused and privacy/learning-state boundaries. All 473 earlier assertions are preserved.

Two new real browser/API scenarios verify narrated board demonstrations, interruption cancellation, delayed-command rejection, refresh, simulated question/hint/response, offline recovery, clearing a board containing only Maya objects, 390px layout, disabled media, zero external provider requests, cross-family denial, forged provider/role rejection, concurrent idempotent initialization and unchanged learning/schedule records. All 11 earlier browser scenarios and every earlier test file remain unchanged.

## 5. Actual test results

| Check                                 | Result                                                                                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                       | PASS: TypeScript, ESLint zero warnings, formatting, 234 unit/service tests across 18 files                                                                                                                                             |
| Local `db:reset`                      | PASS: all eight additive migrations and seed applied                                                                                                                                                                                   |
| `npm run db:lint`                     | PASS: no schema warnings/errors                                                                                                                                                                                                        |
| `npm run db:test` on clean seed       | PASS: 549 assertions across seven files (473 preserved + 76 Phase 6)                                                                                                                                                                   |
| `npm run db:test:seed`                | PASS: two seed executions preserve academic/private-question/publication/audit fingerprints; rolled back                                                                                                                               |
| Targeted development Maya browser run | PASS: both new scenarios (43.6s) before final tool/recovery review                                                                                                                                                                     |
| Full development browser suite        | PASS: all 13 scenarios (2.0m)                                                                                                                                                                                                          |
| Production build                      | PASS: final implementation, including provider selection and dynamic classroom/event routes                                                                                                                                            |
| Production HTTP                       | PASS: home/health/sign-in/verification 200; parent/settings/curriculum/preview/classroom/event requests redirect anonymous callers with 307 and private/no-store handling                                                              |
| Full production browser suite         | PASS: all 13 scenarios against the final production build (1.1m), including every preserved flow and both Maya scenarios                                                                                                               |
| Production dependency audit           | PASS: zero vulnerabilities after adding the SDK                                                                                                                                                                                        |
| Full dependency audit                 | Known limitation: five inherited high development-only findings in Next ESLint → fast-glob → micromatch → braces; suggested fix is a breaking configuration downgrade                                                                  |
| Dependency/environment review         | All direct dependencies match pins; OpenAI 7.32.0 added. Node 24.12.0/npm 11.6.2 locally; configured Node 22 target not tested here. Two inherited optional installation remnants remain (`@emnapi/wasi-threads`, `@img/sharp-wasm32`) |
| Compatibility                         | Earlier migrations, seed and all Phase 0–5 test files unchanged; earlier functionality passes. No remote GitHub CI execution observed                                                                                                  |

Implementation runs found a tool-union type error, a narrow inferred replay return type, test environment typing, an unused SQL variable and a JSON Schema function argument mismatch. These were corrected. The first database run failed at simulation initialization because the schema helper returned JSONB where the installed validation function requires JSON, causing dependent assertions to fail; the corrected suite passed. A later rate-test run completed its assertions so far but stopped on a nested SQL quoting error; the corrected complete run passed. No failed run is counted as a pass.

A schema-generation attempt initially referenced an unavailable optional bundler; it changed no artifacts and was replaced with the installed TypeScript compiler. Provider-selection and voice-proposal validation were reviewed after the full development browser pass. A subsequent board review corrected the Clear control when only Maya objects exist; its new browser assertion passed. Final unit/type/lint/format checks and production build verify those final changes. SQL/schema changes were fully verified before browser fixtures. Development browser tooling emits cosmetic color-environment warnings. Actual local credentials remain ignored, unprinted and uncommitted. No forced audit downgrade was applied.

The first full production suite passed all 13 scenarios before the final Clear-control change. The subsequent rebuilt suite passed 12 scenarios, including both Maya scenarios and the new Clear assertion, but the preserved enrollment scenario timed out at its 15-second URL expectation. An unchanged targeted retry then failed before enrollment with `ERR_TOO_MANY_REDIRECTS`. A temporary diagnostic attempt also failed and is not counted as a pass; its console result was unavailable. A repeated diagnostic recording only HTTP statuses and sanitized paths passed the unchanged enrollment scenario in 4.9 seconds (5.6 seconds total), with ordinary redirects and persisted roadmap reads. The diagnostic file was removed. The final unchanged full production rerun passed all 13 scenarios in 1.1 minutes, including enrollment in 4.2 seconds and the Maya Clear/replay assertion. These intermittent failures resemble previously reported production enrollment issues; their cause is not established, and no authorization check or test timeout was weakened.

## 6. Mock Maya demonstration

Start Docker/local Supabase, configure ignored local keys, then run `npm run dev` or build/use `npm start`. Parent confirmation mail stays at <http://localhost:54324>. Sign in as a verified parent, select/create a student, and enroll in Grade 8 Mathematics with future availability. Enter **Open student preview**, then open the first upcoming supervised classroom.

Choose **Start classroom preview**, **Start Maya simulation**, **Continue Maya simulation**. Observe the signed-integer narration and `−3 + 7` demonstration. Interrupt before application to cancel the pending visual; Continue restarts that segment. Choose Next through `−3 + 7 = 4` and the highlighted understanding question. Ask for a simulated hint/response, refresh to recover committed work, and Stop or End. Keep the guardian present.

Integer arithmetic and Inverse operations are supported when first in the planned lesson; other skills show an unavailable message. Use another future reservation after a terminal rehearsal. This is text-based simulated narration and conversation, with no spoken audio, microphone or AI service.

## 7. Live AI integration status

OpenAI SDK-backed Realtime client-secret and Responses structured-output adapters, capability-validated configurable models, short credential lifetime, SDK timeouts/no automatic retry, and an unused defensive WebRTC voice adapter are implemented **but inactive**. Official API patterns were checked using the OpenAI Docs skill; sources and implementation details are in [Maya integration](MAYA_INTEGRATION.md).

No live credential/proxy route exists. The activation gate always denies live mode, including with a key or feature flag. Ordinary parent/ADMIN identity cannot satisfy developer authorization. Supervised student context independently prohibits external disclosure. The repository lacks trusted developer capabilities and verified spending-cap enforcement; live activation and a real voice smoke test were not attempted. Fake transport tests do not establish operational live audio.

## 8. Voice and whiteboard synchronization status

Mock segment-level coordination is functional and browser-tested: narration is visible while epoch/speech-scoped commands apply at simulated offsets. Only server-committed commands render. Interruption cancels pending actions; stale deliveries fail; saved visuals survive and are not duplicated when restarting an already applied step. Refresh/reconnection reconstructs the actual board and narration state.

No live spoken synchronization or word-level accuracy is claimed. HTTP and authorization latency are present. Future voice must supply actual playback clocks/acknowledgments, reviewed live tools and server cancellation before live synchronization can be verified.

## 9. Cost controls

Mock mode makes zero external requests and records zero estimated external cost. SQL enforces a five-minute simulation horizon, one canonical owned open rehearsal, 60 mock events/minute and reserved history capacity for termination. Unknown/stale requests fail rather than consuming provider usage.

The inactive adapters/configuration include bounded operation timeouts, output limits, zero automatic reconnection/retry, a one-session configuration bound and an estimated usage ledger. These are contracts and defensive adapter behavior, **not a guaranteed live spending cap**. Ephemeral-token expiry and browser timers cannot enforce total active Realtime spend. Paid mode stays disabled until server/provider termination, concurrency, usage reconciliation and approved budget protection are implemented and verified. No exact live dollar cost is reported.

## 10. Security and privacy notes

Auth/RLS and PostgreSQL independently validate the selected student, relationship, real signed session and room. Existing parent/consent/learning mutation restrictions remain intact. No routine service-role bypass or new child credentials are used. Plan pins, private answers, sibling/family data and parent identity remain protected.

Model/tool data cannot override schema/authorization or execute arbitrary mutation tools. No mastery, homework, schedule, publication or consent tool is offered. Existing evidence references are not reclassified as mastery. Logs/operation records omit raw tool arguments, prompts, child names and media. Media controls remain disabled in the functional mock UI. No recording, video, upload, psychological profiling or external data transfer is enabled.

## 11. Known limitations

Two deterministic Grade 8 scripts and bounded text conversation choices; no genuine conversational model, audible voice, live tool execution, live safety moderation or approved child-safety escalation policy. The teaching specification is versioned code with simulation-only activation, not a full policy publication/Teaching Studio system. Existing raw misconceptions and summaries are not loaded without future validated interpretation.

Five-minute expiry is reconciled on the next teaching operation, not by a background worker. An unfinished narration restarts its display clock after refresh. Known rejected operations need refreshed state; uncertain writes offer exact retry. Polling latency, bounded board/history, Phase 4 supervised-credential limitations and terminal rehearsal behavior remain. No secure unattended handoff or independent student login is provided.

The inherited development audit findings, optional installation remnants and untested local Node 22 target remain. Intermittent preserved production enrollment failures, including a redirect loop, remain unresolved despite successful runs; failed attempts and retries are recorded above. No live API availability/account entitlement or live synchronization quality was exercised.

## 12. Founder approvals required

Before activating paid live AI, approve an explicitly scoped adult-only local synthetic test and budget-risk policy, and review/implement trusted developer authorization separate from parent preview/ADMIN flags. Verify server/provider session termination, concurrency, credential revocation, usage reconciliation, a reviewed live proposal producer and enforceable spending protection; if a strict cap cannot be guaranteed, communicate and obtain approval for that limitation while keeping activation disabled.

Before any real child pilot, separately approve jurisdiction/age and guardian eligibility, consent wording/capabilities, student-access/handoff, retention/deletion/withdrawal, moderation/reporting and a staffed escalation policy. Draft consent records are not authorization. No activation or policy approval is inferred from this implementation task.

## 13. Next phase

Phase 7: reviewed assessment, learning evidence, misconceptions and mastery on canonical instructional records. It was not started. Phase 8 owns genuine lesson/homework continuity and Phase 9 adaptive scheduling. The three-consecutive-lessons product milestone is not claimed by this simulation.
