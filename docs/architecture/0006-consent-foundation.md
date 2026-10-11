# ADR 0006 — Versioned consent decisions without invented eligibility

**Decision:** Store separate, versioned capability policies and append-only parent decisions. Keep grants disabled for drafts until policy approval.

**Options:** A general checkbox; mutable current-state booleans; versioned policies with immutable decision history.

**Recommendation:** Use policy category plus version and individual grant/withdrawal events. Categories are AI tutoring, microphone, camera/image analysis, uploads, and optional recording. Every event records parent, student, policy version, decision, timestamp, source, and request UUID. A monotonic event order determines latest decisions reliably even when requests overlap or timestamps tie.

**Why:** One capability's permission cannot authorize another. New policy versions cannot inherit older grants implicitly. Retries do not duplicate decisions, and withdrawals remain possible after a policy is retired. Authorized operations verify the linked parent and lock the relationship. Ordinary service access cannot overwrite/delete decisions; reviewed database-owner maintenance remains possible for future lawful deletion workflows.

**Tradeoffs:** All supplied policies are draft capability descriptions, not approved legal language. The application does not determine age eligibility or claim legal consent. Grants can be exercised in transactional tests using a synthetic approved policy, but no shipped policy is approved. Withdrawals can be recorded now; no child capability is activated by any decision.

**Reversibility:** Add reviewed policies as new versions. Database constraints reject wording/version changes after approval or recorded decisions; approval may be withdrawn without deleting history. Future capability authorization must verify the applicable approved version, current decision, identity, and eligibility rules at time of use. Policy approvals are restricted to trusted operations; no parent-facing approval API exists.

**Founder approval needed before activation:** Policy wording and jurisdiction/age eligibility; guardian authority and disagreements between guardians; which capabilities are required or optional; retention, recording defaults, deletion and withdrawal consequences; student session design. No legal eligibility rules or recording retention periods are invented in this phase.

**Verification:** Tests cover approved grants, denied draft grants, withdrawal, retired-policy withdrawal, immutable history, versions/source/time, retries, isolated families, and forged/unrelated actors. No media collection or AI session code is introduced.
