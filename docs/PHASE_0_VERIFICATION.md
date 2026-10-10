# Phase 0 verification report

Verified on October 10, 2026. Phase 0 only; no Phase 1 product workflows were built.

## 1. What was built

A locally runnable Next.js/TypeScript modular-monolith foundation with Tailwind, Zod environment validation, typed Supabase clients, server-only privileged access, allowlisted structured logging, liveness endpoint, reproducible dependency installation, strict lint/format checks, Vitest, and application/database CI jobs. Docker-backed Supabase is running locally and `.env.local` was generated from its actual credentials without committing them.

## 2. Files and components changed

- Tooling: `package.json`, new `package-lock.json`, `.nvmrc`, ESLint/PostCSS/Prettier configuration, `.gitignore`, and `vitest.config.mts`.
- Application: preserved and formatted the preview page/layout/styles; enabled Tailwind; added `app/api/health/route.ts`.
- Integration: `lib/env.ts`, `lib/supabase.ts`, `server/supabase-admin.ts`, and generated `types/database.ts`.
- Operations: `server/logging.ts`, `server/logging-core.ts`, `scripts/supabase.mjs`, and `scripts/setup-local-env.mjs`.
- Database: additive hardening migration, expanded seed, explicit local config, and behavioral pgTAP suite.
- Documentation and CI: README, ADRs 0003/0004, this report, and `.github/workflows/ci.yml`.

## 3. Database changes

Preserved the original 41-table migration. The second migration adds explicit client privilege restrictions, authorized student/parent reads, restricted ownership helpers, role-consistent identity foreign keys, relationship-backed consent, bounded mastery/confidence/thresholds, unique curriculum positions and plan versions, lesson state/time checks, canonical student ownership across schedules/lessons/homework, evidence-linked nonzero mastery, schedule audit metadata, FK indexes, and restricted default privileges for future migrations.

The Grade 8 math seed contains five skills, five prerequisite edges, planning/assessment metadata, and five private assessment questions. It contains no real identities or credentials. The schema supports future learning workflows but does not implement them.

## 4. Tests added

15 unit tests cover missing/placeholder/privileged keys, HTTP URL validation including malformed input, public/server configuration separation, allowlisted logging with sensitive-field rejection, and a credential-free health response.

201 pgTAP assertions execute real database roles and synthetic JWT subjects. They test both parent/student families, ownership through nested tables, private table denial, anonymous access, ADMIN labels and editable metadata without bypass, forbidden role/relationship/mastery/evidence writes, revoked parent access, trusted service access, curriculum metadata, RLS/privilege coverage, and cross-student/evidence constraints. Fixtures are rolled back.

## 5. Executed results

| Check                                                    | Result                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm install` and clean `npm ci`                         | Passed                                                           |
| TypeScript                                               | Passed                                                           |
| ESLint, zero warnings                                    | Passed                                                           |
| Prettier                                                 | Passed                                                           |
| Vitest                                                   | Passed: 15 tests in 3 files                                      |
| Next.js production build                                 | Passed                                                           |
| Local Supabase startup                                   | Passed after fixing Docker helper PATH                           |
| Local migration reset and seed                           | Passed                                                           |
| Database lint                                            | Passed: no schema errors                                         |
| pgTAP RLS/security/constraints                           | Passed: 201 assertions                                           |
| Development and production homepage/health HTTP requests | Passed: 200 responses                                            |
| Live Supabase REST client smoke check                    | Passed: anonymous denied; service reads five seeded skills       |
| Production dependency audit                              | Passed: zero vulnerabilities                                     |
| Full dependency audit                                    | Unresolved: five high development-only findings rooted in braces |
| GitHub-hosted CI execution                               | Not run: repository has not been pushed                          |
| Hosted Supabase migration/deployment                     | Not run: no remote project linked                                |
| Phase 1 / three-lesson end-to-end tests                  | Not run: features are not implemented                            |

A fresh source copy without `.next` or `.env.local` also passed `npm run check`. Type checking generates Next route types first so it works before the first build.

Commands ran on Node 24.12.0/npm 11.6.2 on macOS. Node 22 is the recommended development and configured CI version; execution on Node 22 itself has not been verified in this session. Supabase used PostgreSQL 17.11.0.004 and CLI 2.120.0. Final database checks reran after default-privilege hardening.

Initial Docker startup/test attempts failed because the credential helper was missing from PATH. The project wrapper corrected that without modifying global Docker configuration, and subsequent startup/tests succeeded. Initial lint warnings and a malformed-URL refinement issue were corrected and retested. The original production PostCSS advisory was resolved with a patched override.

## 6. Run locally

Docker and the local environment file were configured during verification. Run `npm run dev` and open http://localhost:3000. From a fresh checkout, follow the complete README quick start (`npm ci`, `db:start`, `env:local`, local reset/lint/tests, application checks/build, then dev).

No external paid account or hosted Supabase project is required. Local reset destroys local development records; it must not be confused with a hosted migration workflow.

## 7. Known limitations

The full audit reports five high development-only findings in the Next ESLint plugin → fast-glob → micromatch → braces chain. npm offered no patched braces release. These findings are documented, not suppressed; the production tree is clean. A framework downgrade is not an appropriate fix. Reevaluate on dependency upgrades.

Identity flows, role provisioning, consent UI, course enrollment services, prerequisite-cycle enforcement, assessments, mastery calculations, lesson continuity, homework workflows, scheduler, dashboards, storage, and realtime/AI integrations remain planned. Generated database types should be regenerated after migrations. A build/liveness response does not prove future business workflows work.

## 8. Security and privacy notes

All client writes are denied. Parents only read authorized students; students only read themselves. No ADMIN browser bypass exists. The service-role client bypasses RLS and must only be used behind future authenticated, validated, target-authorized services. Public configuration rejects recognizable service keys; server-only imports protect privileged integration.

Answers, raw messages/events, memory, uploads, and operational records are inaccessible to client roles. No storage buckets, raw media collection, or AI calls exist. Logs reject arbitrary sensitive fields. `.env.local` is ignored and created with restrictive permissions; no credentials belong in Git. Test identities are synthetic and transactional. Child-facing deployment still requires the later consent, deletion/retention, moderation, rate limiting, and safety work.

## 9. Next recommended phase

Phase 1: parent authentication, trusted student provisioning and relationships, server-side authorization, and consent foundation. Extend application-service tests before allowing any client mutation. Do not begin dashboards, Maya, or the three-lesson pilot yet.
