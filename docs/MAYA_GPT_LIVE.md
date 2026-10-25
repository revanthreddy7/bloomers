# Maya GPT-Live decision and local classroom

Product decision implemented against recovery commit `b9e97ea`. This document supersedes the earlier Realtime retest model/configuration; those historical incident and verification records remain intact. No Phase 7 work, paid inference, live session, recording or camera activation is authorized by this change.

## Supported model and access

Official [GPT-Live model documentation](https://developers.openai.com/api/docs/models/gpt-live-1) documents **`gpt-live-1`**, not `gpt-live-1.1`. The official-domain search found no documented public API identifier for 1.1. Read-only Models API checks using the configured project key returned **404 for `gpt-live-1.1`** and successful metadata access for **`gpt-live-1` and `gpt-5.6-terra`**. No inference or session creation was used to check access. Metadata access cannot prove successful media negotiation, available capacity or session configuration acceptance. No claim about ChatGPT's internal model identifier is needed for this integration.

The server-only `OPENAI_API_KEY` loads successfully. Ignored `.env.local` selects `MAYA_DEV_MODEL=gpt-live-1`, with live activation **off** and an **empty approval**. The confirmed adult developer remains allowlisted. The original incident and recovery evidence are unchanged. Final inspection found a matching owner-authorized recovery audit at October 24, 2026, 23:44:54.338 UTC: the lease is released, with status `expired_by_policy_remote_termination_unconfirmed` and provider termination still false. This assignment did not remove or recreate the real lease. The old consumed Realtime approval cannot activate the Live path: new approvals must name both `model: "gpt-live-1"` and `backendModel: "gpt-5.6-terra"`.

## Connection and delegation

The existing OpenAI SDK already supports Live; package versions and lockfile are unchanged. The adapter follows [GPT-Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [server-side controls](https://developers.openai.com/api/docs/guides/voice-server-controls) and [client delegation](https://developers.openai.com/api/docs/guides/live-delegation):

1. After adult opt-in and Start, acquire audio only and create a WebRTC offer. The authenticated server sends JSON to `POST /v1/live/sessions` with `transport: {type:"webrtc",sdp}`, `gpt-live-1`, `marin`, `store:false`, client delegation and a synthetic greeting. No API credential is returned to the browser.
2. Apply the returned `transport.sdp`; preserve the opaque provider session ID unchanged on the server. Wait for connected peer, open channel **and `session.started`** before the ready operation. No `session.start` is sent on an already-created WebRTC session.
3. Attach the supported SDK sideband at `/v1/live/sessions/{session_id}/attach`, with reconnection disabled. Send the greeting commentary once. GPT-Live owns full-duplex speaking/listening, conversational turns and delegation; the server never sends legacy Realtime `response.create` to Live.
4. Client delegation contains metadata, not the task text. Keep bounded adult/assistant transcript fragments in process memory and construct backend context from them, the committed board and recent adult pen strokes. No transcript is written to the journal. The backend uses standalone Responses with `gpt-5.6-terra`, `store:false`, no external tools, no automatic retries, 768 maximum output tokens, no reasoning effort and strict structured output.
5. Parse the existing teaching/whiteboard schemas and check erase ownership. Return concise validated narration/question using `session.commentary.append` with the actual delegation ID. The model chooses the mathematics and board actions; no fixed visual sequence is hardcoded.

The frontend data channel is **read-only** at the provider boundary: no client commands are allowed, and only selected lifecycle/transcript/usage events are exposed. Authenticated application endpoints retain control of the session. Canonical parent/student tables, private answers, mastery and homework are not loaded or changed.

## Synchronization and interruption limits

The same application session owns voice, drawing, cancellation epoch and replay. Injection acknowledgments alone never commit a drawing. A pending proposal becomes eligible after its commentary injection acknowledgment and a later output transcript; the browser commits it through the existing epoch-checked acknowledgment only while received remote audio exceeds the audio-activity threshold. This is **best-effort turn coordination**, not sample/word alignment or proof that particular words accompanied the drawing. Live commentary can be paraphrased; its injection acknowledgment does not establish speech delivery. Adult listening remains necessary.

New adult speech invalidates pending visuals and application-owned backend work. Late backend results cannot draw or supply stale narration. The backend receives subsequent conversational context, including corrections. GPT-Live handles natural full-duplex interruption; transcript arrival and cancellation do not independently prove the old audio stopped. Explicit Interrupt pauses local playback and requires Resume. No synthetic microphone indicator or transcript-only Speaking state is used.

The browser measures received audio activity using Web Audio; this drives Speaking versus Listening/Thinking. This does not prove speakers were audible to the tester. First-audio telemetry is a labeled browser observation, never an authorization signal. Thinking reflects pending backend/board work, rather than invented model thoughts. If media analysis is unavailable, do not infer successful board/speech synchronization.

## Minimal call layout

The developer classroom reuses `MayaBoard`, strict drawing commands and normalized pointer coordinates. It has a teacher tile, an adult tester tile, a large board and persistent microphone, disabled camera, board visibility, pause/resume, interruption and end-call controls. Desktop uses a participant column beside the board; mobile stacks the board below compact participant tiles. Telemetry and test prompts are secondary. End-call status remains visible.

Microphone capture requires explicit browser permission after opt-in. Muting disables local audio tracks without ending the call. Pause also mutes provider input and local output; session duration and billing continue while paused. Adult pen input is bounded, validated and session-scoped with idempotent command IDs and stale-epoch rejection. It cannot clear teacher work or promote a stroke to an assessment result. The backend sees bounded coordinate context and must ask for a spoken description when handwriting is unclear. There is no camera permission request, avatar animation or person-to-person video call. Camera remains disabled pending separately approved consent/access/permission safeguards.

## Termination and safety lock

Keep local cleanup separate from provider finalization. Stop immediately releases microphone tracks, peer, data channel, audio context and local timers, and cancels setup/readiness polling. The trusted sideband remains available while the server sends `session.close` and waits up to six seconds for final `session.closed` usage. A socket close or timeout alone is not confirmation. Unknown finalization retains the exclusive lease. If readiness never attached a sideband, cleanup may attach only to the existing provider session to request closure; this cannot create another paid session. There is no automatic new session, retry, fork or reconnect.

The Realtime `rtc_` hangup path and 60-minute recovery policy remain for the **old incident only**. They are not applied to a new Live identifier. A failed Live session needs its own reviewed lifecycle evidence/recovery; manual lock deletion is prohibited. Historical 503s and the original cause remain unresolved. Migrating APIs and passing mocks do not prove that live connectivity is fixed.

## Proposed fresh approval and cost

Proposed next test: one adult-operated local session, synthetic `grade8-adult-v2`, **180 seconds**, `gpt-live-1` with **`marin`**, backend **`gpt-5.6-terra`**, and a **100-cent estimated stop threshold**. At most 12 bounded backend requests, at most 20 delegation IDs, bounded event/pen counts, server duration, 15-second heartbeat/setup expiry, 10-second backend timeout apply. No camera, child, raw audio recording or academic mutation.

[GPT-Live pricing](https://developers.openai.com/api/docs/models/gpt-live-1) is **$0.05 per minute**, billed per second. Three running minutes is **$0.15**. WebRTC creation bills 15 seconds during initialization, credited against running duration rather than added again; failed initialization can still incur that charge. [The backend](https://developers.openai.com/api/docs/models/gpt-5.6-terra) costs $2/million input and $12/million output tokens at the proposed context size. Illustratively, 12 backend calls each with 1,000 input and 300 output tokens would add $0.0672, giving about **$0.22** total. This is an example, not a measured test cost or guarantee. Longer context, actual output and interrupted requests change it.

Because provider usage update cadence is not guaranteed, running voice estimates use the greater of cumulative reported seconds and elapsed/initialization duration; absent final usage stays explicitly incomplete. Accounting also includes known backend tokens and a conservative 20-cent allowance per canceled backend request whose billing is uncertain. That allowance is an application estimate, not an OpenAI fee. Backend start requires 20 cents of headroom. Aborting HTTP does not prove generation stopped or cost is zero. Duration/usage thresholds request termination but cannot enforce a strict dollar ceiling during provider, process or network failure.

The founder reported project hard-limit enforcement enabled, but its amount/configuration has not been independently inspected. [Spend alerts are advisory; enforced project limits reject affected requests, with possible propagation overshoot](https://developers.openai.com/api/docs/guides/spend-limits). Neither is a guaranteed $1 per-test cap here.

## Launch after recovery and fresh founder approval

1. Keep live disabled. Sign in as the allowlisted owner outside student preview and open <http://localhost:3000/developer/maya>. Confirm the old incident shows its completed audited recovery. Use the [existing runbook](MAYA_SESSION_RECOVERY.md) for evidence review if the status differs. Preserve the audit and consumed approval. Recovery alone cannot enable Live.
2. Review the model/backend, synthetic adult scope, 180-second duration, cost estimate, $1 threshold and overshoot/uncertain-finalization risk. Obtain **fresh founder approval** before issuing a new manifest UUID. The current product decision is not that paid-test approval.
3. Only after approval, the local operator configures the one-use manifest with the Live model **and backendModel**, current owner, expiry within one hour, duration 180, budget 100, maxSessions 1 and accepted provider risk. Then enable and restart the loopback-only development server. No manifest is created by this implementation.
4. Open the developer classroom, opt in and Start once. Grant microphone permission. Confirm an audible greeting; ask about negative three plus seven, answer naturally, then ask about `2x + 5 = 15`. Observe model-chosen board work and ask “Wait, why subtract five?” while Maya speaks. Check that the old proposal does not appear after interruption. Continue without Next/Continue.
5. Check mute/unmute, optional pen input, pause/resume, and End. Confirm the browser microphone indicator disappears and inspect final server status/usage. Record what was actually heard and seen separately from automated mock results. On failure, do not retry or reuse approval; preserve diagnostics and lease pending review.

Actual live audio, mathematical teaching quality, interruption recovery and successful Live finalization are still untested. These remain the acceptance blockers until a freshly approved adult session is completed.
