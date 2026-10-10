# ADR 0002 — Structured learning state

**Decision:** Treat transcripts as optional context, not the student model.

**Recommendation:** store attempts, learning evidence, misconceptions, mastery, homework, schedules, and summaries as distinct records. Preserve audit history for schedule changes and idempotency keys in future lesson completion work.

**Tradeoffs:** more schema and validation than chat-only memory. **Reversibility:** easy to extend with richer evidence models.

**Privacy:** avoid raw media retention; keep student content behind RLS and server-side authorization.
