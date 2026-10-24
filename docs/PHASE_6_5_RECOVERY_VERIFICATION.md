# Phase 6.5 session recovery verification

Verified locally against investigation commit `dea63ec`. No paid OpenAI request, new live approval, push, deployment, schema change or Phase 7 work was performed. Mock audio is not a successful live listening test.

## Incident findings

The retained October 12 WebRTC incident lasted 2,241 ms. Its private journal retains the original `rtc_` call identifier, start time 16:55:42.403 UTC, connected time 16:55:44.639 UTC and immediate sideband error at 16:55:44.643 UTC. There is no recorded first audio, board commit or complete usage. Zero estimated cost is not evidence of zero billing. The original journal and consumed approval remain unchanged.

Later hangup and sideband attachment returned HTTP 503; that evidence remains in the investigation record. Existing evidence cannot distinguish a transient provider/edge failure from an integration/configuration problem or establish the cause of the original sideband error. No repeated provider request was made for this assignment.

The implementation uses unified server SDP exchange with `POST /v1/realtime/calls`, a server WebSocket sideband identified by `call_id`, and `POST /v1/realtime/calls/{call_id}/hangup`. These match the reviewed [Realtime call API](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup) and [sideband documentation](https://developers.openai.com/api/docs/guides/voice-server-controls). It does not issue browser API credentials; the long-lived key stays on the server. No supported active-call lookup was identified in the reviewed Calls API. Neither a failed hangup nor closing local sockets confirms remote termination.

[Realtime sessions have a documented maximum duration of 60 minutes](https://developers.openai.com/api/docs/guides/realtime-conversations). The recovery policy uses the later server connection time as a conservative creation upper bound and adds ten minutes: **October 12, 2026, 18:05:44.639 UTC / 11:05:44 AM Pacific**. That boundary has elapsed. This supersedes the earlier estimate based on the pre-call application start time.

The original server processes were confirmed exited. The operator explicitly confirmed all classroom tabs closed and the microphone indicator gone. No retained application connection can reconnect to the old call. Automated tests verify cleanup behavior; they cannot independently inspect a closed historical browser tab or provider state.

## Recovery and cleanup changes

The new authenticated recovery endpoint requires a confirmed allowlisted owner, signed retained Auth session, development/local-origin checks, no preview scope, explicit uncertainty/local-cleanup acknowledgment, trusted private incident evidence and the unchanged lease fingerprint. It computes expiry server-side. New journals retain server-derived owner/approval/process metadata; legacy ownership requires an explicit trusted operator review of the archived matching approval. The browser cannot supply ownership, an expiry date or a lock path.

A shared filesystem mutex serializes recovery and ordinary lease operations. Atomic, restrictive-permission, flushed audit files precede lease removal. Retries return the same audit and cannot delete a newer lease. Interrupted recovery fails closed or resumes only from matching evidence. The recovery status is `expired_by_policy_remote_termination_unconfirmed`; provider termination remains false. The original journal, errors, call identifier and consumed approval are preserved. Recovery never starts a call or issues an approval.

Browser cleanup now cancels readiness polling immediately, aborts setup, clears timers/audio and closes microphone tracks, peer and data channel. Server cleanup is idempotent, invalidates pending generations/board actions and still attempts hangup when cancellation or sideband closure throws. Hangup failure retains the lease. No automatic paid retry or reconnect was introduced.

Structured diagnostics now include attempt UUID, hashed call reference, stage, elapsed time, HTTP status, sanitized provider request ID when supplied, sideband state and browser-reported peer/channel cleanup states. Browser observations are explicitly not authorization evidence. No raw microphone audio, SDP, credentials, provider error body or child information is logged. Next-test diagnostics distinguish SDP acceptance, answer application, connected peer/open channel, sideband upgrade, provider error and cleanup outcome. Their availability does not establish that the historical failure is fixed.

## Executed verification

| Check                               | Actual result                                                                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                     | PASS: TypeScript, ESLint zero warnings, formatting and 297 unit/service tests across 25 files                                                                          |
| Database security suite             | PASS: 562 assertions across eight SQL files in a disposable local database                                                                                             |
| Disposable migration setup          | PASS: existing nine migrations and seed applied; disposable database removed afterward; primary development data was not reset                                         |
| Full browser/API regressions        | PASS: all 14 scenarios, 2.2 minutes                                                                                                                                    |
| Guarded developer browser/API suite | PASS: all four scenarios, final run 18.4 seconds, including actual authenticated recovery, acknowledgment, reload/idempotence, ordinary-parent denial and 390px layout |
| Production build                    | PASS: `npm run build`                                                                                                                                                  |
| Production HTTP smoke               | PASS: home/health 200, parent 307, developer console 404 and session/recovery POST 403; protected responses private/no-store                                           |
| Compatibility                       | Earlier migrations, types, seed, package files and earlier Phase 0–6 test files unchanged                                                                              |

The full browser run preceded the final request-ID/header attribution and file-flush refinements. The final application check, guarded developer suite and production build covered those refinements. Provider/media traffic in browser tests was intercepted; recovery used isolated synthetic files and real local synthetic Auth. The original incident and lease were not released by these tests. The SQL suite used an isolated database because preserved global-count fixtures require a clean seed.

Initial runs exposed an expected-event mismatch after adding `call_created`, a TypeScript SDK request-ID property mismatch and an unbroken status string overflowing the mobile layout; these were corrected before the passing runs. The disposable platform-schema restore initially failed under a non-superuser, then succeeded with the local platform administrator; only the disposable database was recreated. One local HTTP smoke attempt was blocked by the sandbox and passed with local-network permission. An accidentally overwritten tracked voice test was restored exactly before final verification; additional cleanup tests are in a separate file. These failures are not counted as passes.

## Current operational state and next test

The real API key remains configured server-side in ignored local configuration, without being printed. The verified adult identity is explicitly allowlisted. **Live activation is off and the approval manifest is empty.** Trusted recovery evidence for the old incident has been prepared; its original lease is still present. The real recovery audit is pending the owner's authenticated acknowledgment in the console. No privileged impersonation was used to bypass that step.

Open <http://localhost:3000/developer/maya> after signing in as `revanthshada@gmail.com`, outside student preview. Under **Previous failed session**, acknowledge the unconfirmed remote termination and closed local resources, then choose **Recover expired session**. The [recovery runbook](MAYA_SESSION_RECOVERY.md) explains evidence, audit inspection and fail-closed recovery. This action does not enable paid AI.

Proposed next test: **one 180-second session**, `gpt-realtime-2.1`, `marin`, synthetic `grade8-adult-v2`, adult microphone only, no camera/recording/child records; **$1 estimated termination threshold**, at most 40 generated responses and 512 output tokens per response. At the [reviewed model rates](https://developers.openai.com/api/docs/models/gpt-realtime-2.1), 2,000 audio input and 4,000 output tokens would cost $0.32 before additional context/text/reasoning. Actual three-minute cost is unknown and can reach or exceed $1. The threshold is not a guaranteed maximum expenditure.

The founder reports project hard-limit enforcement enabled; amount and actual account configuration were not independently verified. [Spend alerts do not stop traffic, while enforced limits reject affected requests and may overshoot during propagation](https://developers.openai.com/api/docs/guides/spend-limits). Application deadlines, heartbeat/operation timeouts, response bounds and usage thresholds request termination, but process/network/provider failures can leave termination and billing uncertain.

After recovery, fresh founder approval must explicitly cover this configuration and overshoot risk. Only then provision a new one-use approval UUID, activate locally and restart the loopback server. Open the console, opt in, Start once and grant microphone permission. Check audible greeting, spoken answers, dynamic board teaching, interruption, pause/resume and explicit Stop without Next/Continue. Report actual listening and cleanup results separately. The prior approval is consumed. **Live speech, teaching quality and successful provider termination remain unverified.**
