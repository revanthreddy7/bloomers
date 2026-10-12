# Adult-only Maya development checkpoint

Phase 6.5 supplies an internal `/developer/maya` console. It uses a fixed synthetic Grade 8 fixture, `equation-adult-v1`, to explain `2x + 5 = 15`. It does not load student profiles, enrollment pins, private answers, assessment evidence or homework records. The normal student preview remains the Phase 6 mock.

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
| `fixture`                    | `equation-adult-v1`                                                             |
| `model`                      | `gpt-realtime-2.1`                                                              |
| `expiresAt`                  | ISO UTC; future, at most one hour away                                          |
| `durationSeconds`            | 15–120; proposed first smoke test 60                                            |
| `budgetCents`                | 1–100; estimated termination threshold, proposed 25                             |
| `acceptUncappedProviderRisk` | Must be `true`; founder must explicitly accept this limitation                  |
| `maxSessions`                | Exactly 1                                                                       |

The manifest is a local operator configuration record, not a cryptographic proof of a conversation with the founder. The trusted local operator must provision it after approval and keep it Git-ignored. No web UI can issue approvals or edit the allowlist.

Before approval, confirm key availability without printing it, confirm the developer identity, review OpenAI project/account data handling and billing limits, and disclose the exact model, fixture, duration and cost uncertainty. No credits/account settings are purchased or changed by this integration. An API key or enable flag alone is insufficient.

## Connection and unified teaching

The browser requests audio-only permission after an explicit adult opt-in and Start click. It posts bounded SDP to an authenticated same-origin endpoint. The server uses the SDK's unified Realtime call API, obtains the controlled call ID, attaches the SDK WebSocket sideband, then returns an SDP answer; no provider API credential is returned. It supplies versioned synthetic instructions and a single `teach_step` function schema. Automatic provider responses are disabled; the server generates bounded responses after committed spoken turns.

Tools propose strict step/narration/question data. Fixed math visuals support equation, subtraction, division, checking, fraction review and clarification. Out-of-order steps and unknown tools are rejected. The server first acknowledges the function output, waits for its response to finish, then requests the narration. A new response ID binds that narration to the pending board turn. Playback-start acknowledgment commits a validated Phase 5 command. Commands never update learning records.

Input speech-start or explicit Interrupt cancels the current provider response where active, clears playback, increments the cancellation epoch and invalidates uncommitted visuals. Delayed tool calls and playback acknowledgments are rejected. Applied board work survives. The model receives the committed step references when clarifying. Practical turn/step coordination is implemented; word-level synchronization is not claimed.

Refresh recovers the same-process journal and immediately stops the existing call. It does not capture or reconnect. A new approved experiment requires a new manifest UUID. Stop releases browser tracks/peer/channel immediately and requests server hangup; server deadlines and missing-heartbeat expiry are independent of that browser request. There is no camera, upload or recording control.

## Telemetry, budgets and operational limits

The server retains only bounded synthetic board/operation events, token totals, estimated cents, failures, stale rejections and timing proxies. It does not persist raw audio, transcripts, SDP, API keys or narration arguments. Files under `.local/maya` use restrictive creation permissions and are ignored by Git. Inspect them locally for debugging and delete only after operational cleanup/review; no retention policy for child data is established.

`firstAudioMs` and response latency are measured server-observed playback-event proxies. Board latency measures proposal-to-acknowledgment commit. Coordination delay measures provider playback-start observation to server acknowledgment; if that provider event is unavailable, the series stays empty. Interruption latency measures cancellation enqueue time, not confirmation that an audio sample ceased. No missing measurement is filled with zero. Qualitative voice findings remain pending an adult listening test.

The estimate conservatively prices all reported input tokens at $32/million and output tokens at $64/million, ignoring cache discounts and cheaper text. Those audio rates were checked October 11, 2026 against the [official model pricing](https://developers.openai.com/api/docs/models/gpt-realtime-2.1). They are a telemetry estimate, not an invoice or spending guarantee. Missing usage stops the session. One-response overshoot, cumulative context, account terms and telemetry delays create uncertainty. A short test might cost cents to a few tenths of a dollar; no measured live cost exists here. Proposed initial threshold is $0.25 and 60 seconds; approval must acknowledge possible overshoot.

One exclusive filesystem lease spans local processes; a per-approval marker prevents repeated billable starts. Server duration, missing heartbeat, provider-operation timeout, eight-response bound and usage threshold trigger hangup. Hangup failure or an unknown call ID retains the lock. Process crash or network/provider failure can prevent termination; this is not a hard provider-side cap. Never delete `active.lock` to retry before inspecting the provider's active calls and confirming closure. No hard account spending limit has been verified/configured by this work.

## Teaching quality and child prerequisites

[The internal rubric report](MAYA_TEACHING_EVALUATION.md) separates annotated deterministic examples/protocol correctness from subjective educational quality. A successful live test still needs human review for reasoning, accuracy, pacing, thinking time, hint quality, interruption recovery and off-topic behavior. Schema-approved math visuals do not guarantee that the spoken explanation is correct.

This console is adult-only and excludes real minor records. A child pilot still requires approved eligibility/guardian consent, secure student access/handoff, provider retention/data handling, deletion/withdrawal, moderation/reporting, and a staffed safety escalation policy. Internal instructions are not a guaranteed spoken-output privacy or safety filter. No child-safety policy or educational-effectiveness approval is inferred from engineering tests.

Official APIs reviewed: [unified WebRTC connection](https://developers.openai.com/api/docs/guides/voice-webrtc), [server sideband controls](https://developers.openai.com/api/docs/guides/voice-server-controls), [call creation](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create), and [call hangup](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup). SDK 7.32.0 is retained; its optional WebSocket transport is pinned at `ws` 8.22.0.

[Realtime interruption guidance](https://developers.openai.com/api/docs/guides/realtime-conversations) also confirms that clearing WebRTC output removes unplayed audio from conversation context. The adapter uses cancellation plus output-buffer clearing; actual interruption continuity still needs a live listening test.
