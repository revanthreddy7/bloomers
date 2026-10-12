# Approved live attempt: October 12, 2026

Following the founder's explicit approval, one `grade8-adult-v2` / `gpt-realtime-2.1` adult experiment was provisioned with a 300-second duration and $2 estimated termination threshold. The key loaded, local developer authorization passed, and the provider call was created. The server journal recorded connection readiness, then `sideband_error` roughly 2.24 seconds after start. No audio playback or board acknowledgment was recorded. Audible teaching remains unverified.

The browser reported “Connection denied or unavailable,” which did not distinguish provider failure from authorization failure. The repair now uses a connection-failure message, exposes abandoned/consumed approval state, and logs only sanitized sideband error category/HTTP status and hangup HTTP status. Raw SDK messages, provider identifiers, prompts and keys are excluded. Mock tests cover secret-bearing errors and retained hangup failure behavior.

`npm run check` passed TypeScript, zero-warning lint, formatting and all 283 unit/service tests across 23 files. This is engineering verification, not live audio acceptance. No new browser suite or production build was run for this diagnostic/message-only patch.

An operational retry of **hangup for the existing call**, without creating a new session, returned HTTP 503. An inspection of that same call's control WebSocket also returned HTTP 503 and closed with code 1006; no response generation was requested. These checks establish current provider/control unavailability for this call. They do not prove the original sideband failure had the same HTTP status, since that earlier log retained only its stage. Consult the [official hangup contract](https://developers.openai.com/api/reference/typescript/resources/realtime/subresources/calls/methods/hangup).

Live activation is disabled. The approval is consumed, and the exclusive safety lease remains because termination is not confirmed. Usage is incomplete: stored zero token estimates do **not** establish zero actual charges. No new paid call, student record mutation, database reset, public deployment or Phase 7 work was performed during diagnosis.

Before another experiment, confirm closure of this provider call and resolve the retained lease through reviewed cleanup. A new paid session also requires renewed explicit approval; do not delete the lease or reuse the consumed manifest to bypass the gate. No successful live teaching claim is made.
