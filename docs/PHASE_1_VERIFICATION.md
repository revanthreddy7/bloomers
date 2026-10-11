# Phase 1 verification report

Verified October 10, 2026. Built on Phase 0 commit `83e3e25`. No Phase 2 work, remote push, hosted deployment, or paid service was performed.

## 1. What was built

Parent email/password signup, mandatory email confirmation, verification guidance/resend, sign-in, global sign-out, password recovery and reset, persistent SSR sessions, protected parent pages, idempotent parent provisioning, student creation/list/detail/edit/selection, account settings, and versioned consent decisions/history.

The UI is responsive and labeled, with pending states, validation, generic authentication errors, and preserved account/student form values after failures. Parent-managed students receive no independent login credentials. Every capability remains inactive; shipped consent policies are drafts and cannot receive new grants.

## 2. Files and components changed

- `app/auth/[mode]/page.tsx`, `app/auth/confirm/route.ts`, and `app/auth/callback/route.ts`: authentication screens and validated one-time-token/PKCE callbacks.
- `app/parent/`: protected layout, student list and profiles, creation/edit forms, account settings, loading and error states.
- `components/identity/forms.tsx`: accessible stateful forms and consent controls.
- `features/identity/validation.ts`: runtime input schemas, capability labels, and redirect allowlist.
- `server/identity/`: Auth-validated parent access, protected student lookup, and server actions using scoped RPCs.
- `server/supabase-session.ts`, `middleware.ts`, and `lib/supabase.ts`: cookie-based Supabase SSR and session refresh.
- `supabase/migrations/202610100003_identity.sql`, local auth config, email templates, and regenerated database types.
- Three new unit/service test files, a transactional identity SQL suite, Playwright config and browser/API suite, and CI browser checks.
- README, ADRs 0005/0006, local environment setup, dependency lockfile, ignores, and token-path log suppression.

## 3. Database changes

Added bounded grade/learning goals and idempotent creation metadata to existing student profiles. Added separate policy categories and versions, approval state, and consent policy version/source/request/order fields. A new grant requires an approved policy. Decisions are append-only for application roles, and approved/referenced policy wording cannot be rewritten under the same version. Retiring a policy does not prevent withdrawals or erase prior history.

Four authenticated RPCs provision a verified parent, create a linked student atomically, edit permitted fields, and append consent decisions. Parent identity derives from `auth.uid()` and is checked against confirmed Auth identity plus the canonical application role. Direct client table writes remain denied. Transaction locks, request uniqueness, relationship locks, and an atomic per-parent successful-mutation limit protect concurrent operations. Audit records contain operation metadata, not child names/goals or auth tokens.

Both earlier migrations, the curriculum seed, and the original Phase 0 SQL tests remain unchanged. No course assignment, student login, uploads, or AI mutation workflow was added.

## 4. Tests added

33 unit/service assertions for input validation, safe redirects, role/identity stripping, signup behavior, authentication errors, account enumeration resistance, protected routes, expired sessions, password recovery, global sign-out, authorized student/consent operations, and transient provisioning failures. All 15 Phase 0 unit tests remain unchanged.

47 transactional pgTAP assertions cover unverified provisioning denial, STUDENT role preservation, ignored editable role metadata, repeat provisioning, atomic and idempotent student/relationship creation, conflicting requests, minimal student identity, invalid fields, parent isolation, draft grant denial, approved synthetic grants, withdrawals/history/source/version/time, retired-policy withdrawal, policy immutability, protected operations, and rate limits. All original 201 Phase 0 assertions remain unchanged.

Three real Chromium/REST integration tests cover:

1. Signup through the UI, no profile before email confirmation, Mailpit verification, student creation/edit, separate draft permissions and withdrawal history, mobile width, persistence, expired stored-session refresh, one-time email-token replay rejection, protected routes, sign-out, and sign-in.
2. Recovery email, expired/missing session guidance, token verification, password replacement, global sign-out, recovery-token replay rejection, old-password denial, and new-password success.
3. Real authenticated concurrent RPC retries creating one student/relationship and cross-parent read/edit denial.

Approved consent policies exist only inside rolled-back SQL tests; the shipped catalog remains unapproved. Browser tests create synthetic local accounts/profiles. No traces or screenshots are retained by the suite.

## 5. Test results

| Check                                      | Result                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| TypeScript / generated route types         | Passed                                                                                          |
| ESLint, zero warnings                      | Passed                                                                                          |
| Prettier                                   | Passed                                                                                          |
| Unit/service tests                         | Passed: 48 assertions, 6 files                                                                  |
| Local migrations and curriculum seed       | Passed                                                                                          |
| Database lint                              | Passed: no schema errors                                                                        |
| RLS/identity/consent SQL tests             | Passed: 248 assertions, 2 files                                                                 |
| Real Chromium and REST integration         | Passed: 3 tests; final run 13.1 seconds                                                         |
| Production build                           | Passed                                                                                          |
| Production HTTP smoke                      | Passed: homepage, health, signup, protected redirects, invalid callbacks, no external redirects |
| Production dependency audit                | Passed: zero vulnerabilities                                                                    |
| Full dependency audit                      | Five inherited high development-only findings in the braces lint-tool chain                     |
| GitHub-hosted CI                           | Not run; no remote push authorized                                                              |
| Hosted auth / SMTP / CAPTCHA               | Not configured or tested; local Mailpit only                                                    |
| Student login / child media / AI / Phase 2 | Not implemented or activated                                                                    |

Checks ran on Node 24.12.0/npm 11.6.2, Supabase CLI 2.120.0/PostgreSQL 17, SSR adapter 0.12.7, and Playwright 1.64.0/Chromium. CI is configured for Node 22; execution on Node 22 itself has not been observed locally.

Early verification found a reserved SQL variable name, an accessible-label mismatch, and a test locator colliding with Next's route announcer. These were corrected. Authentication form values now survive server errors. An initial build failed because it overlapped a browser dev server sharing `.next`; sequential reruns passed. Final reported results come from the corrected runs, not the initial failures.

## 6. Test the parent signup flow

Start Docker and local Supabase, ensure `.env.local` includes actual local keys and `APP_ORIGIN=http://localhost:3000`, then run `npm run dev`. Open http://localhost:3000/auth/sign-up. Create a test account with a unique email and a password of at least 12 characters. Open http://localhost:54324 and follow the verification email. Add/edit/select a student and record a capability withdrawal. Sign out and back in. Use Forgot password and the local recovery email to reset the password.

Full fresh-checkout steps are in the README. Auth config/template changes require `db:stop` followed by `db:start`. `db:reset` destroys local development data. For automation, install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e` with local services available and port 3000 free. Do not run builds concurrently with Playwright's dev server.

## 7. Known limitations

No shipped legal consent policy is approved; grant controls are deliberately disabled for drafts. The framework and approved-policy grant path are implemented and tested, but legal eligibility and capability activation remain unresolved. Only parent profiles exist; there is no student login, invitation, guardian-sharing UI, deletion workflow, tutoring, or course planning.

The inherited five development-only lint-tool audit findings remain documented, not suppressed. Supabase Auth provides centralized auth limits, while database throttling limits successful parent mutations; neither is a complete public deployment abuse-control strategy. Hosted SMTP, exact redirects, CAPTCHA/edge controls, and logging policies need environment-specific setup. Authentication failures caused by email cooldowns use non-enumerating messages.

## 8. Security and privacy notes

No identity workflow uses blanket service-role access. Reads remain behind RLS; writes pass through verified-parent, actor-derived operations. User metadata, selected student URLs, and submitted roles/parent IDs cannot authorize access. Provisioning does not upgrade existing student/admin roles. No minor email, birthdate, address, medical detail, media, or AI interaction is collected by these workflows.

Server Actions use Next's Origin checks; database RPCs independently authorize JWT actors, so bypassing the UI cannot bypass permissions. Session identity is validated through Auth; private responses are not cached. Callback redirects are constrained and token-bearing URLs use no-referrer headers with development log suppression. Operators must configure canonical origins and hosting/CDN log redaction.

Global sign-out revokes refresh sessions and removes this browser's cookies. Already-issued access JWTs may remain valid until their expiry; local access lifetime is 15 minutes. A stricter production revocation requirement needs an explicit session policy. Service and database-owner access still requires trusted operational controls. Consent erasure requires a future reviewed privacy workflow; ordinary service callers cannot silently overwrite/delete history.

## 9. Decisions requiring founder approval

Before an external child pilot, approve actual consent wording and jurisdiction/age eligibility, guardian authority/conflict handling, required versus optional capabilities, recording/retention/deletion and withdrawal consequences, and a student-access model. Approving a draft description is not a legal review. Before public deployment, decide SMTP/abuse-control setup and whether the token-expiry revocation window is acceptable. No approval is needed to review the local, inactive-capability implementation.

## 10. Next phase

Phase 2: curriculum domain/services over the existing small mathematics graph. Do not add lessons, Maya, scheduling, analytics dashboards, or student credentials as incidental Phase 2 work.
