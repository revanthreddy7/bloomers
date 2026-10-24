# Phase 6.5 verification report

Engineering checkpoint verified October 11, 2026 against Phase 6 commit `9792f3f`. Work is local. No push/deployment, paid provider request, actual microphone/camera capture, child pilot or Phase 7 workflow. **Stage A: Engineering Ready.** Stage B live voice validation remains pending explicit founder approval and local configuration.

## 1. What was built

A separate adult-only synthetic Maya developer classroom with trusted operator allowlisting, verified retained Auth sessions, scoped one-session approvals, server-mediated WebRTC creation, authenticated server sideband control, fixed validated equation tools, narration/playback board acknowledgments, cancellation generations, durable local operational journals, estimated usage thresholds and fail-closed cleanup. The normal parent-assisted classroom remains mock-only.

Capability classification: developer authorization, deterministic controller/tool/replay/cleanup tests and disabled real-browser console are **implemented and tested**. OpenAI transport and audio/board coordination are **implemented but not live-tested**. Existing student teaching remains **mock-only**. Paid activation is **disabled pending approval**. Child use, educational effectiveness, full conversational moderation, secure handoff and Phase 7 learning intelligence are **not implemented**.

## 2. Existing components reused

Supabase SSR/Auth clients and preview scope, canonical lesson state vocabulary, Phase 5 strict normalized Maya command envelope, Phase 6 SVG board renderer, shared responsive styles and the pinned OpenAI SDK. Earlier student storage, publications, reservations, learning evidence and mock producers remain unchanged. The developer call lease is operational experiment state, never a competing student lesson or source of genuine attendance.

## 3. Files changed

- `features/maya/development*.ts`, `evaluation.ts`: synthetic fixture, policy/tools/events/snapshots, reviewed math steps, browser transport and annotated rubrics.
- `server/maya/developer-auth.ts`, `development-{transport,session,service}.ts`: gates, SDK call/sideband/hangup, serialized controller, leases/journals, scoped replay and exact start retries.
- `/developer/maya` page/API and `components/maya/development-room.tsx`: internal classroom, explicit adult opt-in, states, stop and review prompts; route privacy headers.
- Auth transient-error classification, parent gate and middleware: retryable temporary failures; local metadata-only backend/enrollment timing instrumentation.
- Additive Auth-session migration, generated types and SQL tests; new unit/service/browser tests and guarded developer-browser script.
- `ws` 8.22.0 and `@types/ws` 8.18.2 pinned; existing dependency versions preserved. Environment examples, ignored `.local` state, README, ADR 0012, development/evaluation documentation and this report.

## 4. Database changes

The ninth additive migration introduces `is_current_auth_session_active()`, an authenticated own-session predicate checking the signed JWT subject/session, confirmed email, retained Auth row and `not_after`. Anonymous execution and raw Auth-session access remain denied. It grants no developer role, paid permission or learning write. No tables or student records are added; earlier migrations/seed unchanged. Developer journals are ignored private local operational artifacts, not public learning data.

## 5. Tests added

41 new unit/service tests cover local/production gates, operator identities, retained sessions/preview denial, missing keys and approvals, model/configuration rejection, official SDK payloads and server call control, exact math/step ordering, playback acknowledgment, idempotency, interruptions/stale tools, replay, duration/heartbeat/operation timeout, usage limits/unknown usage, session reconfiguration, uncertain hangup, real filesystem concurrency and one-use approvals, explicit media opt-in and browser cleanup. Annotated positive/negative rubrics cover all five requested scenarios. Auth regression tests demonstrate temporary-failure denial without sign-in bounce and metadata-log privacy.

13 PostgreSQL assertions cover real privileges, valid/foreign/expired/deleted/malformed/missing Auth sessions, unconfirmed users, hidden raw session/preview state and unchanged learning-write denial. Every earlier test/migration remains unchanged.

One normal browser scenario denies ordinary-parent access/forged live start/guessed session replay. A separately registered guarded scenario uses an actual allowlisted synthetic Auth account to open the disabled console, check microphone OFF/disabled paid start, deny direct activation and verify 390px layout. The script forces paid flags off and cleans its fixture account/file/app process.

## 6. Actual test results

| Check                                        | Executed result                                                                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                              | PASS: TypeScript, ESLint zero warnings, formatting, 275 unit/service tests across 23 files                                                                  |
| Local `db:reset`                             | PASS: all nine migrations and seed                                                                                                                          |
| `db:lint`                                    | PASS: no public-schema warnings/errors                                                                                                                      |
| Clean-seed `db:test`                         | PASS: 562 assertions across eight files (549 preserved + 13 new)                                                                                            |
| `db:test:seed`                               | PASS: two seed executions preserve fingerprints, rolled back                                                                                                |
| `test:maya:development`                      | PASS: both real-browser scenarios, allowlisted-disabled and ordinary-parent-denied (12.6s)                                                                  |
| Full development browser suite               | 13 PASS / 1 FAIL (3.3m): preserved curriculum navigation stayed on listing and timed out                                                                    |
| Unchanged curriculum development retry       | PASS: 13.3s scenario, 22.4s total                                                                                                                           |
| Production build                             | PASS: final production build, including developer page/API                                                                                                  |
| Production HTTP / full browser suite         | PASS: ten HTTP routes; all 14 production browser scenarios on both initial (1.2m) and final (1.1m) runs                                                     |
| Repeated production enrollment investigation | Five repeats: 4 PASS / 1 FAIL (36.4s); three subsequent traced repeats failed; next traced single run passed (5.0s)                                         |
| Production dependency audit                  | PASS: zero vulnerabilities                                                                                                                                  |
| Environment/dependencies                     | Existing direct pins retained plus two WS packages. Node 24.12.0/npm 11.6.2 locally; Node 22 target untested. Inherited optional extraneous packages remain |

Initial checks found test environment typing, SDK event typing and formatting issues; corrected runs passed. Installing with legacy-peer mode removed Vitest's required Vite peer and an initial test could not start. The prior lock entries were restored, only the two new packages retained, and `npm ci --ignore-scripts` plus subsequent executed tests passed. The first guarded-browser script failed before fixture creation on a CommonJS named import; corrected default import and rerun passed. No failed attempt is counted as a pass.

SQL checks ran against the clean reset before browser fixtures. Browser fixtures alter local counts; reset before repeating global-count SQL suites. Build/type generation and browser development servers were sequential. Keys stayed ignored/unprinted; no remote GitHub CI run or forced dependency downgrade.

## 7. Live connection readiness

Engineering pathway implemented and tested with fake provider transports; actual authenticated local console tested while disabled. Official unified WebRTC, sideband, call creation/hangup patterns and supported `gpt-realtime-2.1` were reviewed with the OpenAI Docs skill. [Exact contracts and official links](MAYA_DEVELOPMENT.md) document compatibility and operational prerequisites.

Actual configuration inspection returned: API key absent; developer allowlist empty; live enable false; approval absent. No credentials were printed. An ordinary parent account is insufficient. Stage B cannot start until the local key, verified developer identity and scoped founder approval are configured.

## 8. Live smoke test results

**Not performed; pending approval.** No real spoken exchange, natural interruption, audible synchronization quality, usage reconciliation or provider termination was observed. Fake SDK/peer tests are not live audio validation. Adult listening and educational review remain necessary.

## 9. Voice/whiteboard synchronization findings

The deterministic controller binds a reviewed board proposal to a server turn UUID, provider response ID and epoch. Speech-generation requests wait for the preceding function response to finish. Playback-start acknowledgment commits a typed command; exact retries deduplicate. Interrupt cancels/clears active output, invalidates pending generations, rejects delayed tools/acks and preserves committed visuals. Same-process refresh replays saved board state and stops the orphaned call without recapturing or reconnecting.

This is teaching-step coordination, implemented but not live-tested. No word-level alignment or measured live delay is claimed. Event clocks provide latency proxies; missing provider playback timestamps remain unmeasured. A process restart blocks live recovery pending reviewed cleanup.

## 10. Teaching quality evaluation

[Internal evaluation report](MAYA_TEACHING_EVALUATION.md) contains correct-answer, wrong-answer, prerequisite, interruption and off-topic rubrics. Deterministic examples and negative cases validate annotations, selected response bounds and technical cancellation/privacy behaviors. Fixed board math is correct and scope-limited. These tests do not establish that a live model follows the rubric or is educationally effective.

Natural pauses, thinking time, conversational coherence, hint usefulness, spoken mathematics, excessive explanation and board confusion await adult human observation. No authoritative student grade, misconception or mastery is persisted from these evaluations.

## 11. Actual and estimated costs

Application provider requests/usage/cost during Stage A: **zero**. Audio token counts and live response timings: unavailable. Current model pricing and the conservative telemetry formula are documented in [development integration](MAYA_DEVELOPMENT.md); estimates are not invoices.

Proposed first test: OpenAI Realtime `gpt-realtime-2.1`, voice `marin`, fixed synthetic equation, one adult, one approved session, 60 seconds, eight generated responses maximum, 256 output tokens/response and $0.25 estimated termination threshold. No Responses/planning model call is included. Estimated test cost is cents to a few tenths of a dollar, with context/usage uncertainty and possible threshold overshoot. **No hard provider-side spending cap has been verified or configured.**

Server duration, heartbeat/provider timeout, filesystem concurrency, one-use approval and usage threshold are tested. Network/provider failure or process crash may prevent hangup; telemetry arrives after usage. Failed/unknown termination retains the lock and blocks future starts. Live activation requires explicit acceptance of uncapped-provider risk; no guaranteed maximum bill is offered.

## 12. Enrollment timeout investigation

A concrete conditional redirect defect was demonstrated with mocked temporary Auth errors: parent retrieval redirected to sign-in, while sign-in can validate the session and redirect back to parent. Parent temporary failures now show a retryable error; temporary middleware claim failures return private/no-store 503. Missing/invalid credentials still redirect/deny, with no cookie-only authorization fallback. This fix addresses that demonstrated path, not every historical timeout.

Opt-in local instrumentation times student authorization, publication read, enrollment RPC and Auth/backend fetches, recording only named stage, status and duration. No SQL query, UUID, email, token, body or error message is logged. Existing atomic enrollment RPC/locking/planning/redirect contract and prior tests remain unchanged.

Cold development full suite recorded one unrelated curriculum navigation failure; enrollment passed in 12.9s. The unchanged curriculum retry passed. Startup/compilation load and navigation timing remain hypotheses; no database-lock or Auth-network root cause is inferred from that retry. Five production repetitions of the unchanged enrollment scenario yielded four passes (3.6–4.2s) and one 15-second navigation timeout (17.7s scenario; 36.4s group). The failed page remained at **Creating roadmap…**. In this five-run sample, authorization had a 56ms median/64ms maximum; publication lookup 4ms/5ms; enrollment RPC 175ms/196ms. RPC duration includes application/client, HTTP/PostgREST and database work; it is not an isolated PostgreSQL transaction measurement. Auth-user requests had a 39.5ms median/61ms maximum and password-token requests 141ms/146ms. No token refresh was observed in this sample. The fast returned RPCs narrow these particular failures toward post-transaction response/navigation handling, without proving the cause.

Three subsequent repetitions with temporary sanitized HTTP listeners all failed the same navigation assertion. A further unchanged traced run passed in 5.0s: enrollment POST returned 303 with the correct roadmap action-redirect at 284ms and finished at 355ms. The roadmap GET returned 200 at 68ms and finished at 93ms. Canceled navigation/prefetch requests were also observed; these alone are not evidence of a defect. Temporary browser instrumentation was removed before the final suite. One diagnostic attempt could not start because sandbox networking denied the listener; its escalated rerun produced the recorded successful trace.

A sampled PostgreSQL activity snapshot showed 16 idle ClientRead connections and no lock waits. This point-in-time observation cannot exclude transient contention. Fixture creation occurs before enrollment submission; its full duration was not independently measured. Production runs remove development compilation as an explanation for these production failures. The 15-second browser assertion is unchanged; increasing it would mask the symptom rather than establish a fix.

The remaining enrollment timeout is **unresolved**. Next investigation should capture the complete failed POST response lifecycle and Next server-action redirect/revalidation/client transition together, then correlate database wait sampling and session refresh under the same reproduction. Compare cold versus warm navigation/prefetch behavior and fixture/session churn. These small sequential samples are not a population failure-rate estimate. Historical Phase 3/5/6 failures remain acknowledged; successful retries alone are not a fix claim.

## 13. Security and privacy

Long-lived API key stays server-only; browsers receive SDP, never provider credentials. The developer endpoint authenticates before bounded body parsing, checks same origin/host, denies production/public origins, scopes replay/mutations to the exact verified user/Auth session, and rejects student IDs/provider overrides/unknown tools. Student preview cannot enter developer mode. Developer experiments query no child/assessment records and cannot write canonical learning data.

No automatic capture, video, upload, recording or audio/transcript journaling. Provider usage is disabled during default tests. Local journals retain bounded synthetic board commands and operational metadata under ignored restrictive-permission files. SDK errors are curated; logs omit raw prompts/tool arguments. Unexpected session reconfiguration fails closed. Application privacy does not establish provider zero-retention; account handling requires review before activation.

## 14. Founder approvals required

Your Phase 6.5 brief explicitly requires approval before the first billable request. Configure the API key locally without sharing/committing it and identify an allowlisted verified developer. Then approve the exact synthetic/adult scope, model, duration, proposed threshold and non-guaranteed cost risk. Check account/project data handling, billing controls and available spending limits before issuing the one-session manifest. No purchase or account-setting change is authorized by this implementation.

Child testing requires separate approved eligibility/guardian consent, secure student credentials/handoff, provider retention/deletion/withdrawal, moderation/reporting and staffed escalation. This adult fixture cannot authorize a minor pilot.

## 15. Remaining limitations

No live provider/audio/educational validation yet. Reviewed fixed equation visuals and annotated rubrics do not guarantee spoken correctness, prompt confidentiality or safety handling. No strict provider cap, crash-proof termination, automatic reconnection, distributed worker, full Studio/policy activation, child handoff, live moderation or genuine learning continuity. Local operator configuration and cleanup remain trust boundaries.

Historical enrollment latency remains under investigation despite a tested transient-redirect fix. Cold development navigation failure is recorded. Inherited five high development-only dependency findings, optional installation remnants and untested local Node 22 target remain; production audit is clean.

## 16. Phase 7 readiness

Phase 7 was not started. The typed context/proposal/event boundaries support future reviewed assessment work, but experiments must never become genuine learning evidence. Proceed only with Phase 7's separately specified scope; live Phase 6.5 educational validation remains pending.

## 17. Session recovery follow-up

See [session recovery verification](PHASE_6_5_RECOVERY_VERIFICATION.md) and the [operational runbook](MAYA_SESSION_RECOVERY.md) for authenticated expired-session recovery, cleanup/connection diagnostics, executed regression results and the proposed next adult test. This follow-up preserves the unconfirmed provider termination and requires fresh paid approval; it does not establish a successful live listening test.
