# ADR 0003 — Phase 0 authorization and database boundaries

**Decision:** Combine explicit PostgreSQL privileges with RLS and enforce ownership in foreign keys. Provisioning and every write remain server-only in Phase 0.

**Options:** RLS alone; browser write policies for all features immediately; deny client writes and open audited reads incrementally.

**Recommendation:** Use the third option. Parents read linked students; students read their own learning records. Nested records follow the parent row's RLS. Catalog access requires authentication. An ADMIN label grants no browser bypass.

**Why:** Phase 0 has no authenticated application workflows yet. Parent/student links, consent, mastery, evidence, assessment results, homework, schedules, and role assignment must not be forgeable from a browser. Composite foreign keys reject cross-student lesson/schedule/homework references and evidence references. Nonzero mastery requires evidence for the same student and skill.

**Tradeoffs:** The service-role client bypasses RLS; future services must verify the authenticated actor, validate input, and enforce target authorization before invoking it. Evidence references provide provenance, not a completed assessment or mastery engine. Catalog prerequisite cycles and full course enrollment semantics will need deterministic validation in later phases.

**Reversibility:** Additive policies and application services can enable specific workflows in Phase 1 and later. Do not change an applied migration: create a new migration. The original starter migration is preserved; hardening is additive.

**Privacy:** Raw lesson events/messages, question answers, memory, uploads, AI/tool runs, safety events, and audit logs have no client read policy. Parent reports are parent-only. No storage buckets or media collection exist. Logs accept only approved operational fields. Local seed data contains no people or credentials; security-test identities are synthetic and rolled back.

**Verification:** pgTAP exercises actual roles and JWT subjects, both families, unrelated/admin/anonymous access, revoked relationships, metadata spoofing, privileged write attempts, service access, and database constraints. CI resets the local database and runs lint plus pgTAP.
