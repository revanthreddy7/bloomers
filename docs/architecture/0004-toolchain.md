# ADR 0004 — Reproducible Phase 0 toolchain

**Decision:** Retain Next.js 15, React, TypeScript, Tailwind, Zod, and Supabase, with exact direct dependency versions and a committed npm lockfile.

**Options:** Upgrade the framework major immediately; retain the starter release line with patched versions; keep unrestricted floating installs.

**Recommendation:** Retain the Next.js release line, upgrade testing tools, and override PostCSS with a patched compatible release. Use Node 22 in development and CI. Supabase CLI is a local dev dependency so no global CLI installation is needed.

**Why:** Avoid unnecessary framework migration during foundation verification. A lockfile and `npm ci` make CI repeatable. Tailwind's PostCSS integration establishes the specified styling stack without redesigning the placeholder page.

**Tradeoffs:** A development-only braces advisory remains in the Next ESLint plugin's fast-glob dependency chain, with no patched braces release available at verification time. Do not apply npm's suggested framework downgrade or suppress this finding. Production dependency auditing is enforced in CI; reassess the development dependency on upgrades. Treat untrusted repositories and glob patterns as untrusted input.

**Reversibility:** The PostCSS override can be removed when Next ships the patched version; any dependency update must repeat lint, unit tests, build, and audit.
