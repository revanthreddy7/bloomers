# Phase 6.5 live smoke attempt

October 12, 2026. The founder approved the previously proposed single adult-operated synthetic session: OpenAI `gpt-realtime-2.1`, voice `marin`, fixture `equation-adult-v1`, 60-second server deadline, eight generated responses maximum, 256 output tokens per response and a $0.25 estimated termination threshold. Cost overshoot was disclosed. No Phase 7 work or deployment occurred.

The server key loaded without being printed. The intended local developer account was email-confirmed and explicitly allowlisted. The founder reported enabling project hard-limit enforcement; its dollar amount/account configuration was not independently inspected. The application was bound to `127.0.0.1:3000` in development mode. The adult user initiated the browser test.

| Observation                  | Result                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Provider call creation       | A provider call ID was obtained; start endpoint returned 200.                                    |
| Recorded session duration    | 1,938 ms.                                                                                        |
| Final state                  | Abandoned, one provider failure.                                                                 |
| First playback event         | None recorded.                                                                                   |
| Committed whiteboard actions | Zero.                                                                                            |
| Input/output usage           | No complete usage response received. Stored zero counters are not measured zero usage.           |
| Estimated/actual cost        | $0.00 telemetry placeholder with `usageComplete=false`; actual bill unknown. No zero-cost claim. |
| Provider termination         | Hangup succeeded, `terminationConfirmed=true`; exclusive active lease released.                  |
| Subsequent activation        | Disabled; approval cleared and development server restarted. No second provider call.            |

**Result: failed live smoke test.** No successful audible teaching or whiteboard synchronization is established. Natural interruption and educational quality were not validated. The saved event journal contains only start and generic provider-failure events; it does not identify the underlying error. Failure occurred after controlled call creation, but these records cannot distinguish provider error, unexpected session/response event or another controller/transport failure. More precise sanitized failure diagnostics are needed before a further live attempt. Do not infer a particular root cause or bypass the fail-closed behavior.

The one-session approval has been consumed. Any additional paid test requires a new explicit approval and one-use manifest after diagnostic preparation. Existing raw audio/transcript storage remains disabled. Private operational files and all local credentials remain Git-ignored.
