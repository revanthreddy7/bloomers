# ADR 0010 — Supervised classroom on the canonical lesson timeline

**Decision:** Reuse canonical lessons, pinned reservations/plans and lesson events for supervised rehearsals. Keep instructional records distinct through an explicit mode. Authorize writes through narrowly scoped PostgreSQL operations inside the existing parent-assisted preview.

**Why:** A second whiteboard/session store would fragment ordering, recovery and later teaching evidence. The existing Phase 4 parent mutation restriction remains intact; a new gate checks the signed Auth session, selected student, canonical role, relationship and intended open lesson independently. Partial unique indexes and student/session locks protect concurrent starts and transitions.

**Lifecycle:** One rehearsal per reservation; one open rehearsal per student. Ready/start, pause, resume, end and lazy abandonment have explicit transitions and an ordered audit timeline. Exact request retries do not duplicate events. Early future rehearsals are allowed; expired/cancelled reservations are denied. Rehearsals never demonstrate attendance or advance learning. A visible heartbeat maintains a 15-minute recovery lease; explicit parent return closes unfinished previews.

**Whiteboard:** Compact strict commands with normalized coordinates; bounded event size/rate/history; deterministic replay and epoch cancellation. No full image per stroke, arbitrary executable markup, AI commands or raw transcript persistence.

**Transport:** Authenticated HTTP polling now, a deterministic local replay transport for tests, future approved WebRTC voice alongside the same validated event timeline. Playback acknowledgments drive speech references; tool-call arrival times do not establish audiovisual synchronization. Pending commands cancel on interruption.

**Tradeoffs:** Two-second delivery, pointer-only drawing, whole-stroke erasure, bounded history and terminal one-reservation rehearsals. No offline drawing merge or distributed broker. Rehearsals retain the parent credentials and inherit supervised-preview handoff limitations; they are not an independent child login.

**Reversibility:** A push transport can replace polling while preserving ordered canonical events. Real lessons, future instructional evidence and Maya proposals require separate approved producers/capability gates; preview events cannot become evidence automatically.

**Privacy:** No media capture, uploads, AI calls, private answers, parent account props or routine service-role bypass. Only the authorized selected student can be read. Raw event REST access remains denied. See [classroom contracts](../CLASSROOM_INFRASTRUCTURE.md) and [ADR 0009](0009-application-shell-and-student-preview.md).
