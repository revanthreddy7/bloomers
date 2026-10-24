# Adult-only Maya development checkpoint

Phase 6.5 supplies an internal `/developer/maya` console. It uses the versioned synthetic Grade 8 fixture `grade8-adult-v2` for conversational integer arithmetic and linear equations. Maya chooses examples and board actions from the discussion; no fixed sequence or Next/Continue button drives the live lesson. It does not load student profiles, enrollment pins, private answers, assessment evidence or homework records. The normal student preview remains the Phase 6 mock.

## Engineering validation without paid calls

Run the normal checks and `npm run test:maya:development` after stopping other app servers. The script creates a guarded local synthetic Auth account, allowlists it only in its child development process, forces `MAYA_DEV_ENABLED=0` and an empty approval, and runs the ordinary-parent denial and allowed-but-disabled console checks. It removes its credential file and Auth account and shuts down its app process group. No external model or real microphone is used. Do not run type generation/build concurrently with its dev server.

Pure fake-transport tests exercise session creation/control, ordered tool/narration turns, playback acknowledgment, cancellation, delayed-event rejection, replay, thresholds, timeouts, transport failure and browser track cleanup. These establish protocol behavior, not operational audio or model teaching quality.

## Authorization and activation

Long-lived OpenAI credentials are server-only. Access requires development mode, the exact configured local HTTP origin/host, an email-confirmed Auth identity whose UUID is allowlisted in server `MAYA_DEV_USER_IDS`, matching verified JWT subject/session, a retained unexpired Auth session, and no active supervised preview. Roles and caller-controlled metadata/cookies cannot replace these checks. Parent consent drafts are not used.

For approved live operation, run `npm run dev -- --hostname 127.0.0.1` and verify the listener is loopback-only before configuring activation. Host/origin checks alone do not prove the network binding; this is a trusted local-operator prerequisite. Do not expose the development server through a proxy, tunnel or public interface. The guarded Stage A browser script binds loopback automatically.

Live start additionally requires `MAYA_DEV_ENABLED=1`, a server API key, the supported model and an operator-authored `MAYA_DEV_APPROVAL` manifest **only after explicit founder approval**. No manifest or paid activation was configured during Stage A. Manifest fields:

| Field                        | Constraint                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `approvalId`                 | New UUID; exactly one start per approval, consumed even after uncertain failure |
| `developerId`                | Allowlisted verified Auth user UUID                                             |
| `fixture`                    | `grade8-adult-v2`                                                               |
| `model`                      | `gpt-realtime-2.1`                                                              |
| `expiresAt`                  | ISO UTC; future, at most one hour away                                          |
| `durationSeconds`            | 15–300; proposed adult lesson test 180                                          |
| `budgetCents`                | 1–200; estimated termination threshold, proposed 100                            |
| `acceptUncappedProviderRisk` | Must be `true`; founder must explicitly accept this limitation                  |
| `maxSessions`                | Exactly 1                                                                       |

The manifest is a local operator configuration record, not a cryptographic proof of a conversation with the founder. The trusted local operator must provision it after approval and keep it Git-ignored. No web UI can issue approvals or edit the allowlist.

Before approval, confirm key availability without printing it, confirm the developer identity, review OpenAI project/account data handling and billing limits, and disclose the exact model, fixture, duration and cost uncertainty. No credits/account settings are purchased or changed by this integration. An API key or enable flag alone is insufficient.

## Connection and unified teaching

The browser requests audio-only permission after an explicit adult opt-in and Start click. It posts bounded SDP to an authenticated same-origin endpoint. The server creates the controlled call and returns its SDP answer first. The browser applies the answer and waits for a connected peer and open data channel, then posts an authenticated ready operation. Only then does the server attach the SDK WebSocket sideband and initiate teaching; no provider API credential is returned. It supplies versioned synthetic instructions and a single `teach_step` function schema. Automatic provider responses are disabled; the server generates bounded responses after committed spoken turns.

Tools propose strict step/narration/question data. Board actions reuse the existing strict Maya protocol, including bounded text/math, normalized shapes/graphs, highlights, pointing, clear and scoped erase. Unknown tools, malformed arguments, unrelated erase targets, concurrent pending proposals and stale generations are rejected. Schema validation does not prove mathematical correctness; adult review remains necessary. The server first acknowledges the function output, waits for its response to finish, then requests the narration. A new response ID binds that narration to the pending board turn. Playback-start acknowledgment commits a validated Phase 5 command. Commands never update learning records.

Input speech-start or explicit Interrupt cancels the current provider response where active, clears playback, increments the cancellation epoch and invalidates uncommitted visuals. Delayed tool calls and playback acknowledgments are rejected. Applied board work survives. The model receives actual committed board objects when clarifying. Spoken turns remain in the Realtime conversation; no raw transcript is journaled. Pause disables microphone tracks and cancels pending output; resume explicitly continues from actual board state. Paused sessions retain heartbeat and duration limits. Practical turn/step coordination is implemented; word-level synchronization is not claimed.

Refresh recovers the same-process journal and immediately stops the existing call. It does not capture or reconnect. A new approved experiment requires a new manifest UUID. Stop releases browser tracks/peer/channel immediately and requests server hangup; server deadlines and missing-heartbeat expiry are independent of that browser request. There is no camera, upload or recording control.

## Telemetry, budgets and operational limits

The server retains only bounded synthetic board/operation events, token totals, estimated cents, failures, stale rejections and timing proxies. It does not persist raw audio, transcripts, SDP, API keys or narration arguments. Files under `.local/maya` use restrictive creation permissions and are ignored by Git. Inspect them locally for debugging and delete only after operational cleanup/review; no retention policy for child data is established.

`firstAudioMs` and response latency are measured server-observed playback-event proxies. Board latency measures proposal-to-acknowledgment commit. Coordination delay measures provider playback-start observation to server acknowledgment; if that provider event is unavailable, the series stays empty. Interruption latency measures cancellation enqueue time, not confirmation that an audio sample ceased. No missing measurement is filled with zero. Qualitative voice findings remain pending an adult listening test.

The estimate conservatively prices all reported input tokens at $32/million and output tokens at $64/million, ignoring cache discounts and cheaper text. Those audio rates were checked October 11, 2026 against the [official model pricing](https://developers.openai.com/api/docs/models/gpt-realtime-2.1). They are a telemetry estimate, not an invoice or spending guarantee. Missing usage stops the session. One-response overshoot, cumulative context, account terms and telemetry delays create uncertainty. A 3–5 minute conversation may cost cents to around a dollar or more depending on cumulative context, audio and reasoning; no measured live cost exists here. Proposed next lesson threshold is $1.00 and 180 seconds; approval must acknowledge possible overshoot.

One exclusive filesystem lease spans local processes; a per-approval marker prevents repeated billable starts. Server duration, missing heartbeat, provider-operation timeout, 40-response bound with 512 output tokens/response and usage threshold trigger hangup. Hangup failure or an unknown call ID retains the lock. Process crash or network/provider failure can prevent termination; this is not a hard provider-side cap. Never manually delete `active.lock`. A verified expired session can use the authenticated, audited [recovery runbook](MAYA_SESSION_RECOVERY.md); that workflow preserves unconfirmed remote termination. The founder reports project hard-limit enforcement is enabled; the amount/account configuration has not been independently inspected. Current OpenAI documentation distinguishes spend alerts from enforced limits, and notes delayed enforcement/possible overshoot. See [spend controls](https://developers.openai.com/api/docs/guides/spend-limits). This application cannot guarantee instant termination or a dollar cap.

## Teaching quality and child prerequisites

[The internal rubric report](MAYA_TEACHING_EVALUATION.md) separates annotated deterministic examples/protocol correctness from subjective educational quality. A successful live test still needs human review for reasoning, accuracy, pacing, thinking time, hint quality, interruption recovery and off-topic behavior. Schema-approved math visuals do not guarantee that the spoken explanation is correct.

This console is adult-only and excludes real minor records. A child pilot still requires approved eligibility/guardian consent, secure student access/handoff, provider retention/data handling, deletion/withdrawal, moderation/reporting, and a staffed safety escalation policy. Internal instructions are not a guaranteed spoken-output privacy or safety filter. No child-safety policy or educational-effectiveness approval is inferred from engineering tests.

Official APIs reviewed: [unified WebRTC connection](https://developers.openai.com/api/docs/guides/voice-webrtc), [server sideband controls](https://developers.openai.com/api/docs/guides/voice-server-controls), [call creation](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create), and [call hangup](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup). SDK 7.32.0 is retained; its optional WebSocket transport is pinned at `ws` 8.22.0.

[Realtime interruption guidance](https://developers.openai.com/api/docs/guides/realtime-conversations) also confirms that clearing WebRTC output removes unplayed audio from conversation context. The adapter uses cancellation plus output-buffer clearing; actual interruption continuity still needs a live listening test.

## Stage B repair and live status

The student-preview classroom deliberately uses `MockTeaching` with inactive voice. It must not silently send real child context to a provider when a key is configured. Confirmed allowlisted developers have a parent-navigation link to the isolated adult test. The screenshot's offline/simulation controls belong to that separate preview; enter `/developer/maya` in parent mode to test live teaching.

Two previously approved live attempts ended after about two seconds without recorded audio or board activity; hangup succeeded but costs are unknown. Their journals cannot establish the cause. The repaired handshake removes an observed startup ordering problem and tests now exercise browser readiness before sideband/greeting. Failure journals distinguish setup, sideband closure/error, unexpected responses, provider events and validation failures without raw provider messages. This is engineering evidence, not proof that the historical failures are fixed. A new 3–5 minute adult test requires explicit approval before activation. See [repair verification](PHASE_6_5_TEACHING_REPAIR.md).

Expired-session recovery and current retest configuration are described in [the recovery runbook](MAYA_SESSION_RECOVERY.md). Recovery does not issue paid approval; the proposed next test is 180 seconds with a $1 estimated threshold, pending fresh founder approval.
