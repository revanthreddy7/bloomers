# Maya expired-session recovery runbook

This is local operational recovery for a failed adult Realtime WebRTC experiment. Recovery does not confirm provider termination, reconstruct usage, issue approval or create a call. It cannot authorize child use. Keep `MAYA_DEV_ENABLED=0` and `MAYA_DEV_APPROVAL=` until a separately approved test is ready.

## Evidence and timing

The retained `.local/maya/SESSION_UUID.json` must identify a controlled `rtc_` call, an abandoned session, an unconfirmed termination and the approved Realtime model. Use a **server-recorded successful create-return timestamp**, or a later **server-recorded sideband-connected timestamp** as a conservative creation upper bound. Browser dates, the local five-minute deadline, failed hangup responses and empty usage totals cannot establish remote expiry.

[OpenAI's Realtime lifetime limit](https://developers.openai.com/api/docs/guides/realtime-conversations) is 60 minutes. Recovery policy adds **ten minutes**. The server, rather than the browser, calculates:

`recoverAfter = creationUpperBound + 3,600 seconds + 600 seconds`

For the October 12 incident, the later connection timestamp is 16:55:44.639 UTC. Recovery becomes eligible at **18:05:44.639 UTC / 11:05:44 AM Pacific on October 12**. This is slightly later than the earlier estimate based on the pre-call start timestamp. Lifetime and margin have elapsed. Remote hangup remains unconfirmed; billing remains unknown.

The operator must verify the old process is gone, all old classroom tabs are closed, microphone capture has stopped, and no application process can reconnect. Close tabs rather than merely muting. The current browser code never automatically reconnects. If local cleanup cannot be established, keep the lock.

## Prepare trusted local evidence

With live mode disabled, run:

```sh
node scripts/prepare-maya-recovery.mjs SESSION_UUID DEVELOPER_AUTH_UUID --review-owner --acknowledge-local-cleanup
```

The script writes a private, exclusive `.local/maya-recovery/SESSION_UUID.evidence.json`. It does not release the lock. It requires operator allowlisting, a known failed call and a consumed approval marker. New journals retain owner/approval/process metadata. For a legacy journal without owner metadata, the operator must review the archived `.local/maya-approved-smoke.json`; its owner, fixture, model and budget must match the incident. This is explicitly an operator attestation, not a claim that a legacy cryptographic ownership link existed.

Evidence binds the owner, journal/call hashes and exact lease fingerprint (hash, inode and modification time). The filesystem is a trusted local-operator boundary. Do not edit evidence to bypass a rejection. Never import a different operator's incident merely to unblock your own call. The script refuses to overwrite existing evidence. Missing or changed evidence requires investigation.

Set `MAYA_DEV_RECOVERY_SESSION_ID=SESSION_UUID` in ignored `.env.local`. The October 12 incident is already prepared. Keep its original incident, approval marker, archived approval and HTTP 503 records unchanged. No new hangup request is needed for policy recovery, and there is no retry loop.

## Authenticate and recover

Start `npm run dev -- --hostname 127.0.0.1`. Do not run build/type generation concurrently. Sign in as the allowlisted adult owner, leave student preview, and open <http://localhost:3000/developer/maya>.

Under **Previous failed session**, check the acknowledgment that remote termination was not confirmed and that all old local resources are closed. Choose **Recover expired session**. The endpoint independently validates local origin/host, development mode, confirmed canonical Auth identity, signed retained Auth session, operator allowlist and absence of student-preview scope. The caller cannot submit an owner, lifetime, model, expiry date or lock path. The checkbox is necessary acknowledgment, not sufficient authority.

Recovery validates the server-side evidence, unchanged incident, exact current lease and elapsed lifetime/margin. It shares a filesystem mutex with normal lease claim/release. Competing requests fail closed as busy; retry the same recovery after completion. A durable audit is written before unlinking the matching lease, then completed afterward. Duplicate requests return the same audit without touching a newer lease. Interrupted recovery resumes from a matching pending audit; a changed lease is rejected.

## Audit and failure handling

Inspect `.local/maya/recoveries/SESSION_UUID.json`. It records actor UUID, authorization time, explicit uncertainty acknowledgment, policy source/durations, creation upper bound, recovery boundary, journal/evidence/call hashes and lease-release state. The original journal retains the raw call identifier and errors privately. The recovery status is:

`expired_by_policy_remote_termination_unconfirmed`

`providerTerminationConfirmed` remains **false**. An actual provider-acknowledged hangup remains a separate historical fact represented by the original session's termination telemetry; policy recovery must never fabricate `provider_confirmed_terminated`.

If the endpoint denies recovery, reload and inspect the evidence/time/ownership checks. A crash can retain `lease-operation.lock`; do not automatically delete it. Stop application processes, inspect the pending audit and exact lease, and obtain trusted operator review. A pending audit plus a missing lease may be completed idempotently; a different lease must remain intact. Do not remove `active.lock` manually. Preserve usage uncertainty even after policy expiry.

## Next live test: approval still required

Proposed configuration is **one 180-second adult synthetic session**, `gpt-realtime-2.1`, `marin`, `grade8-adult-v2`, **$1.00 estimated termination threshold**, 40 generated responses maximum and 512 output tokens per response. No camera, raw audio recording, real child participation or canonical academic writes. The call may fail again; mock tests do not establish a fix for the original connection error.

[Model rates](https://developers.openai.com/api/docs/models/gpt-realtime-2.1) are $32/million audio input tokens and $64/million output; text is $4/$24 and cached input $0.40. Illustratively 2,000 uncached audio input plus 4,000 output tokens costs $0.32 before additional context/text/reasoning. This is an example, not a measured three-minute estimate. Expect variable cost, potentially reaching or exceeding the $1 threshold. Repeated context and delayed/incomplete usage can increase charges. The estimator conservatively applies audio rates to all reported tokens.

The founder reported enforced project spending limits, but their amount/configuration has not been independently inspected. [Spend alerts are advisory; enforced spend limits reject affected requests, with possible delayed enforcement and overshoot](https://developers.openai.com/api/docs/guides/spend-limits). Neither credit balance nor this application's threshold is a strict per-test hard cap. The application requests hangup on duration, missing heartbeat, generation/connection timeout, response-count limit, unknown usage or estimated budget threshold. Network/process/provider failures can prevent confirmed termination and permit billing uncertainty.

After recovery, report/review this configuration and obtain **fresh founder approval**, including overshoot risk. Only then issue a new one-use UUID manifest for the owner, with `durationSeconds:180`, `budgetCents:100`, future expiry within one hour, `maxSessions:1` and accepted risk. Configure live activation and restart the loopback server. The previous approval cannot be reused. Open the developer classroom, opt in, click Start once and grant microphone permission. Confirm greeting, a dynamic board example, spoken answer/hint, interruption (“Wait, explain that again”), natural progression without Next/Continue, pause/resume and Stop. Record audible outcomes separately from metadata. No automatic retry after a failure.
