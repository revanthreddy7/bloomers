# Phase 6.5 Stage B preparation

Checked October 12, 2026 against `a7bd6ba`. No OpenAI API request, live activation or microphone capture was performed. Phase 7 was not started.

## Current findings

| Check                | Result                                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server key           | The saved `.env.local` has no `OPENAI_API_KEY` assignment, and Next's development environment loader reports no loaded key. No secret was printed. Save the editor buffer and recheck before activation. |
| Secret protection    | `.env.local` is Git-ignored; no public OpenAI key variable was found.                                                                                                                                    |
| Developer identity   | `MAYA_DEV_USER_IDS` is empty. No account is currently authorized. Founder must identify the intended local sign-in email; resolve that account's UUID without creating or promoting a user.              |
| Live flag / approval | Disabled; approval absent. No manifest was issued.                                                                                                                                                       |
| Model / voice        | Code pins `gpt-realtime-2.1`, voice `marin`; no environment override is set.                                                                                                                             |
| Fixture              | `equation-adult-v1`, policy `maya-adult-dev-1`, synthetic Grade 8 equation `2x + 5 = 15`. No child profiles, private answers or learning-state writes. Adult opt-in required.                            |
| Transport            | Server-only SDK unified WebRTC call creation, call-ID sideband and server hangup match current official contracts. Project/key validity and model access have not been tested with OpenAI.               |
| Local app            | Existing server listens on `127.0.0.1:3000`. Restart in development mode for this route; production denies developer access.                                                                             |
| Operational lease    | No `.local/maya/active.lock` was present at inspection.                                                                                                                                                  |
| Tests                | 34 focused authorization, SDK-contract, voice-cleanup and controller tests passed across four files. Provider, microphone and peers were mocked.                                                         |

The allowlist is a trusted server configuration, separate from canonical parent/ADMIN roles. Every request also validates confirmed Auth identity, signed matching session, retained unexpired Auth row and absence of supervised preview. Merely adding a UUID does not bypass those checks.

## Pricing and spending controls

Current [official model pricing](https://developers.openai.com/api/docs/models/gpt-realtime-2.1): per million tokens, uncached audio input $32/output $64; text input $4/output $24; cached input $0.40. No separate planning/Responses call is proposed. Actual cost remains unmeasured; a short synthetic interaction is expected to cost cents to a few tenths of a dollar, depending on audio, context and generated responses.

The application estimates all input/output tokens at the higher uncached audio rates. It terminates after reported cumulative usage reaches the approved threshold. This is an estimate, not prepaid reservation or a guaranteed cap. Proposed first approval: one session, 60 seconds including setup, $0.25 estimated termination threshold, at most eight generated responses, 256 output tokens per response. Tool generation and spoken narration can consume separate responses, so this is not eight complete teaching turns.

Independent server controls include the duration deadline, 15-second missing-heartbeat/provider-operation deadlines, exclusive local filesystem lease, one-use approval UUID and no automatic reconnection/retry. Stop closes local tracks/peer/channel immediately and requests provider hangup. Unknown creation or failed hangup retains the lock; inspect termination before another approval. Process/network failure can prevent confirmed hangup.

Current [OpenAI spend-limit documentation](https://developers.openai.com/api/docs/guides/spend-limits) distinguishes **spend alerts** (notifications; traffic continues) from **Enforce a hard limit** (affected requests return 429 after tracked spend reaches the monthly organization/project limit). Hard-limit enforcement is delayed and can slightly overshoot. Neither the configured project amount nor the enforcement toggle has been independently inspected here. Founder confirmation is pending. These docs do not establish immediate termination of an already-open Realtime call when the project threshold is reached; keep the application hangup controls.

## Launch instructions

Before approval:

1. Save `.env.local` with `OPENAI_API_KEY=...`. Do not use `NEXT_PUBLIC_`, share the key or commit it. Recheck loading using a boolean-only check; this alone does not verify the key's project or permissions.
2. Identify the adult developer's local Bloomers sign-in email. Set `MAYA_DEV_USER_IDS` to that exact confirmed user's Auth UUID after verification. Leave `MAYA_DEV_ENABLED=0` and `MAYA_DEV_APPROVAL` empty.
3. Confirm the Bloomers Development project monthly amount and whether **Enforce a hard limit** is enabled. Ensure its key can use the approved Realtime model; no billing or permission changes are made by this preparation.
4. Stop the existing app server in its terminal. Keep Docker/local Supabase running. From this repository run `npm run dev -- --hostname 127.0.0.1`. Use `http://localhost:3000` consistently, matching `MAYA_DEV_ORIGIN=http://localhost:3000`; do not tunnel the server.
5. Sign in as the verified developer, exit supervised preview, then open `http://localhost:3000/developer/maya`. It should display the synthetic classroom, Microphone OFF and a disabled Start button. A 404 means developer authorization/host/session prerequisites are not satisfied.
6. To inspect microphone permission without capturing media, run `navigator.permissions.query({name: 'microphone'}).then(p => console.log(p.state))` in the browser console if supported. `prompt` awaits explicit consent; `denied` requires enabling the site's permission and the browser's OS microphone access. The actual user's browser/device permission has not been verified here.

Only after explicit founder approval:

1. Provision a new one-use manifest in ignored `.env.local` with the approved developer UUID. Set `MAYA_DEV_ENABLED=1`, `MAYA_DEV_MODEL=gpt-realtime-2.1` and `MAYA_DEV_APPROVAL` to a single-quoted JSON value containing `approvalId` (new UUID), `developerId`, `fixture: "equation-adult-v1"`, `model: "gpt-realtime-2.1"`, `expiresAt` (future ISO UTC, within one hour), `durationSeconds: 60`, `budgetCents: 25`, `acceptUncappedProviderRisk: true`, `maxSessions: 1`. Generate timestamps shortly before testing; the schema rejects expired approvals. Restart the development server and recheck the authenticated disabled/ready state. No page load creates a provider call.
2. Open the developer classroom, use headphones, check the adult/synthetic microphone opt-in, then click **Start approved voice test**. Grant browser microphone permission. This explicit click is the first potentially billable operation.
3. Confirm the connection/listening/speaking state, greeting and equation board. Say: “Help me solve two x plus five equals fifteen.” At subtraction, ask: “Wait, why subtract five?” Check that pending work stops, existing visuals remain and the explanation resumes from actual board state. When asked, answer: “Divide both sides by two.” Do not use real child names or records.
4. Click **Stop and disconnect** before the 60-second deadline. Verify Microphone OFF, terminal session state and `terminationConfirmed: true`. Review available token totals/estimated cost and actual project usage. If termination is unconfirmed, do not retry or delete the lock; inspect and close the provider call first.
5. Set `MAYA_DEV_ENABLED=0`, clear the approval and restart after the test. Preserve only bounded synthetic operational metrics/review notes. Refresh stops/replays; it does not reconnect or grant a second session.

Actual microphone function, audible interruption quality and speech/whiteboard coordination remain live-test findings. Current tests establish ordered turn/epoch/response acknowledgment, stale rejection, committed-state replay and cleanup with fakes; they do not establish word-level synchronization or educational effectiveness.

Official compatibility sources: [WebRTC unified interface](https://developers.openai.com/api/docs/guides/voice-webrtc), [server controls](https://developers.openai.com/api/docs/guides/voice-server-controls), [create call](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create), [hang up call](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup). Detailed constraints: [Maya development guide](MAYA_DEVELOPMENT.md).

## Approval checkpoint

Pending: saved/loaded key, explicitly identified and authorized developer, project spend configuration confirmation and founder approval for the exact first test. Approval must accept that $0.25 is an estimated termination threshold and provider/account enforcement can overshoot. The user's Phase 6.5 brief and current request explicitly require approval before live activation. No paid call or activation is authorized by preparation alone.
