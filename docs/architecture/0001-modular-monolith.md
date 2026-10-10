# ADR 0001 — Modular monolith

**Decision:** Next.js app/API, TypeScript domain modules, Supabase PostgreSQL and RLS.

**Options:** microservices; monolith; modular monolith.

**Recommendation:** modular monolith.

**Why:** one deployable product with clear domain seams while validating the three-lesson loop.

**Tradeoffs:** API and frontend share deployment; strict module boundaries require discipline.

**Reversibility:** domain modules can be extracted when operational needs justify it.

**Safety:** no direct LLM database mutations; AI produces validated proposals and deterministic application services commit changes.
