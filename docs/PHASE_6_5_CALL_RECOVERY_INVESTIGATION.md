# Failed Realtime call: recovery investigation

Investigated October 12, 2026. No call was created, model response requested, approval issued or consumed, or safety lease removed during this investigation. Live activation remains disabled. The local development server was stopped to close application process resources. No Phase 7 work was performed.

## Connection and endpoint verification

This is the existing Realtime API WebRTC integration, using browser microphone audio and a server sideband WebSocket, with `gpt-realtime-2.1`/Marin. It is not a SIP call, standalone model WebSocket session, Responses request or the separate GPT-Live API. Creation used multipart `POST https://api.openai.com/v1/realtime/calls`; its `Location` supplied the retained `rtc_` call identifier. The application checks that location path before retaining the identifier. The browser received an SDP answer and the server journal subsequently recorded connection readiness.

The installed OpenAI 7.32.0 SDK implements `client.realtime.calls.hangup(callId)` as **POST `/v1/realtime/calls/{call_id}/hangup`**, without a request body. This matches the [current official WebRTC/SIP hangup contract](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup). The same API key is used for create, sideband and hangup. There is no evidence of an incorrect hangup method or path; switching to `/live/sessions` would mix distinct API contracts.

## Supported checks performed on the existing call

At 17:44:58 UTC a direct authenticated POST to the retained call's hangup URL returned HTTP **503**, independently of the SDK. The response had no content type, `Retry-After` or `x-request-id`; it reported `server: cloudflare` and supplied no recognized structured error category. No raw error body, key or call identifier was printed.

At 17:44:59 UTC the read-only `/v1/models` API returned **200** using the same credentials. This establishes general API reachability and accepted credentials for that read. It does not establish Realtime call-control health or prove every credential permission.

At 17:45:58 UTC an authenticated connection to the documented existing-call sideband URL, `wss://api.openai.com/v1/realtime?call_id={callId}`, returned HTTP **503** and closed with WebSocket code **1006**. It never attached; no model response or session creation command was sent. See [official server-side controls](https://developers.openai.com/api/docs/guides/voice-server-controls).

The reviewed [Realtime Calls reference](https://developers.openai.com/api/reference/typescript/resources/realtime/subresources/calls) exposes create, accept, hangup, refer and reject, but no REST list/retrieve-active-call method. No invented GET-status endpoint was attempted. A successful sideband attachment could establish an existing session, but an unsuccessful attachment does not establish closure. Account billing reports likewise cannot prove current call liveness. No organization-admin key or provider dashboard session is available for authoritative account usage inspection.

## Local cleanup and telemetry

The founder explicitly confirmed all classroom tabs were closed and the microphone-in-use indicator was gone. This is human confirmation, not direct browser instrumentation. Closing those documents disposes their media tracks, peer connections, data channels, readiness/poll/deadline timers and pending requests. The reviewed failure path also calls browser cleanup, stopping every stream track, closing peer/channel, clearing timers, aborting its controller and detaching playback. API operation requests have independent ten-second timeouts. Browser microphone permission may remain granted even when capture is inactive.

The failed call belonged to development-server process 56916, which had already exited. Before stopping the replacement server, `lsof` showed only its loopback listener and no established outbound connections. Process 57467 was then stopped. Process checks found neither PID, and no listener remains on port 3000. These exited processes cannot retain sideband sockets, application session registry entries or timers. Persistent journals, the consumed approval marker and `active.lock` remain intentionally intact; disk history is not an active call resource.

The retained failed-session journal records start at **16:55:42.403 UTC**, connected at **16:55:44.639**, then `sideband_error` at **16:55:44.643**. Duration before local abandonment was **2,241 ms**. No playback or board acknowledgment was recorded. Usage remains incomplete and remote termination unconfirmed. Stored zero token/cost estimates are missing telemetry, not a zero-charge result. Logs and private investigation files contain bounded operational metadata; no child academic records, raw audio, transcripts or credentials were exposed. New private HTTP/sideband evidence is retained under ignored `.local/` paths outside the session-journal directory.

## Interpretation and expiry

The 503 is repeatable across the SDK, direct HTTP and existing-call WebSocket checks. It is therefore not explained solely by SDK request construction. A call-routing/service dependency failure or an unavailable stale call is plausible; the exact root cause remains unknown. There is no structured `server_is_overloaded` error, so model capacity overload is not established. Cloudflare's header identifies an intermediary, not which internal component failed. The original `sideband_error` predates the richer diagnostics, so later 503 responses cannot prove that was its original cause. See [official error guidance](https://developers.openai.com/api/docs/guides/error-codes).

At the 17:45:58 check, the session was approximately **50 minutes old**. [OpenAI documents a maximum Realtime session duration of 60 minutes](https://developers.openai.com/api/docs/guides/realtime-conversations), placing the documented lifetime boundary at approximately **17:55:42 UTC** (10:55:42 America/Los_Angeles). That boundary had not elapsed at the check. The application's five-minute deadline and expired approval do not prove provider expiry.

**Current evidence classification: remote termination still unknown.** There is no successful hangup acknowledgment or authoritative session-ended observation. Once the documented lifetime has elapsed, expiry can support an inference that this specific session cannot remain live under the documented contract; it must be recorded as inferred expiry rather than fabricated hangup confirmation. It cannot reconstruct usage or resolve the original connection failure.

## Recommended fix and safe recovery

Keep live mode disabled, the approval consumed and the lease retained. Preserve the failed journal unchanged. Do not clear the lock solely because of HTTP 503, browser cleanup, a zero estimate or the local timer.

For this call, use bounded, spaced existing-call hangup checks; a successful documented hangup response can establish termination-request acceptance. If call control continues returning ambiguous failures, obtain provider confirmation using the private retained call identifier, timestamps, API/model/connection details and sanitized response metadata. No support message has been sent. A generic 404/503 alone must not be relabeled as confirmed termination without documented semantics. After the lifetime boundary, any recovery relying on expiry needs an explicit operational review recording the source, elapsed lifetime and remaining billing uncertainty; do not silently set `terminationConfirmed=true`.

Engineering follow-up: retain sanitized SDK error categories and HTTP status, add per-operation client request IDs/provider request IDs for support correlation, and record browser resource cleanup evidence. Add a bounded operator-only cleanup workflow that distinguishes acknowledged hangup, inferred expiry and unresolved termination. It must never create a call, issue approval or automatically release an uncertain lease. These recommendations do not activate live testing. A new experiment remains separately founder-approved after recovery and connection diagnosis.

This investigation changes documentation only. Source cleanup and existing mock tests were reviewed; no new mock result is presented as direct verification of the founder's audio session.

## Recovery implementation follow-up

The original evidence above remains historical. The 60-minute lifetime plus a ten-minute margin has now elapsed. The new [recovery runbook](MAYA_SESSION_RECOVERY.md) implements authenticated owner acknowledgment and an audited `expired_by_policy_remote_termination_unconfirmed` classification, preserving the original journal and uncertainty. The conservative recovery boundary uses the later server connection timestamp (11:05:44 AM Pacific on October 12), rather than the pre-call start timestamp. Trusted evidence for this incident is prepared; the real lock awaits the owner’s authenticated acknowledgment. No new provider call or cleanup retry was made during implementation.
