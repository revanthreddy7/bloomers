# Bloomers V1 — Phase 1

Verified foundation plus parent identity: signup, verified email, sign-in/out, password recovery, protected parent pages, student profiles, and versioned consent decisions. Maya and the three-lesson pilot remain planned. `/api/health` checks liveness, not database readiness.

## Run locally

Prerequisites: Node **22** (recommended, `.nvmrc`), npm, and a running Docker Desktop or compatible engine. Supabase CLI is a project dependency; no global CLI, hosted project, AI credentials, or paid service is needed.

```sh
nvm install
nvm use
npm ci
npm run db:start
npm run env:local
npm run db:reset
npm run db:lint
npm run db:test
npm run check
npm run build
npm run dev
```

If you do not use nvm, install Node 22 directly and skip the first two commands. Open [localhost:3000](http://localhost:3000). Supabase Studio is at [localhost:54323](http://localhost:54323). Keep local services on a trusted development machine and do not expose them publicly.

First startup downloads Docker images and may take several minutes. Start Docker Desktop and wait for its engine before running `db:start`. The macOS wrapper handles Docker Desktop's credential-helper path without modifying your Docker configuration. Resolve port conflicts on 3000 or 54321–54324 before starting.

`env:local` reads actual local keys from the running stack and writes a private, Git-ignored `.env.local`. It never prints keys or overwrites an existing file. If the file already exists, edit it manually using `npx supabase status` and the names in `.env.example`. Never paste service keys into chat or commit them. The preview and build need no credentials; database clients validate configuration when invoked.

**`db:reset` deletes the local development database** and reapplies migrations plus seed. It explicitly uses `--local`. Only run it when local data can be discarded. Tests roll back synthetic fixtures.

Stop Supabase with `npm run db:stop` (retains database volumes). Stop Next.js with Ctrl+C. To run the production server, stop the dev server, run `npm run build`, then `npm start`.

## Commands and checks

| Command                                       | Purpose                                                       |
| --------------------------------------------- | ------------------------------------------------------------- |
| `npm run check`                               | TypeScript, ESLint with zero warnings, formatting, unit tests |
| `npm run format`                              | Apply Prettier formatting                                     |
| `npm run build`                               | Next.js production build                                      |
| `npm run db:reset`                            | Apply local migrations and seed                               |
| `npm run db:lint`                             | Fail on database schema warnings/errors                       |
| `npm run db:test`                             | pgTAP authorization and constraint tests                      |
| `npm audit --omit=dev --audit-level=moderate` | Production dependency audit                                   |

See the [Phase 0 report](docs/PHASE_0_VERIFICATION.md) and [Phase 1 report](docs/PHASE_1_VERIFICATION.md) for actual results. CI uses clean installs, application checks/build, a production audit, and a separate Supabase reset/lint/test job. GitHub execution requires pushing the repository and has not been observed locally.

## Modular monolith

One Next.js deployment and one Supabase PostgreSQL database:

- `app/`: routes and presentation.
- `lib/`: shared environment validation and browser Supabase client.
- `server/`: server-only admin client and allowlisted structured logging.
- `supabase/`: migrations, curriculum seed, and pgTAP tests.
- `tests/`: environment, logging, and liveness unit tests.
- `types/database.ts`: generated schema types used by both Supabase clients.
- `scripts/`: local CLI and credential helpers.
- `docs/architecture/`: architectural decisions and authorization boundaries.

Future identity, curriculum, learning, scheduling, lesson, assessment, homework, memory, reporting, and AI services should use focused domain/feature modules. UI calls authorized application services; deterministic services validate AI proposals before writing. Empty scaffolding and pretend implementations are intentionally absent. Read the [build brief](docs/BLOOMERS_V1_BUILD_BRIEF.md) before expanding scope.

## Database and authorization

The initial migration creates 41 domain tables. An additive hardening migration restricts client privileges, adds constraints and FK indexes, and opens audited read policies. The seed provides five Grade 8 mathematics skills, five prerequisites, assessment metadata, and five private questions. It creates no student accounts.

Parents read linked students; students read their own records. Nested records follow parent-row RLS. All direct browser table writes remain denied. Verified parents can invoke narrowly authorized identity RPCs to create/edit linked students and append consent decisions. Actors are derived from validated JWTs, never caller-provided parent IDs. Privileged learning state remains unwritable. An ADMIN role label grants no browser bypass. Raw lesson events/messages, question answers, memory, uploads, and operations have no client read policies. Parent reports are parent-only. Storage buckets and media collection are not provisioned.

The service-role client bypasses RLS. **Future callers must authenticate and authorize the actor and target student before invoking it.** `server-only` prevents client imports. Public configuration rejects recognizable privileged keys. The Phase 1 workflows use the authenticated SSR client and scoped RPCs, without service-role bypass. Service-role credentials are used only by local integration-test fixtures and the preserved future admin utility.

Logs accept only approved operational fields. Student names, answers, prompts, tokens, audio, and video are not accepted by the logging API.

### Migration workflow

```sh
npx supabase migration new describe_change
# Edit the new SQL file, then:
npm run db:reset
npm run db:lint
npm run db:test
node scripts/supabase.mjs gen types typescript --local --schema public > types/database.ts
npx prettier --write types/database.ts
```

Never edit a migration already applied remotely. New tables need explicit grants and audited policies; default privileges restrict new client access. Reuse canonical ownership and composite foreign keys for cross-record student references. Never use editable user metadata to grant application roles.

## Environments

Local development uses Docker. Staging and production require separate Supabase projects and separate deployment secrets. No hosted project is linked or deployed here.

When a hosted environment is needed in a later phase:

1. Create a dedicated Supabase project for that environment.
2. Put its URL and anon/publishable key in the deployment's public environment variables; keep the service-role/secret key only in the server secret store. Preserve the variable names in `.env.example`.
3. Configure exact auth redirect URLs, confirmation/SMTP, and access controls.
4. Apply reviewed migrations through deployment controls. Never reset hosted data or load synthetic security-test fixtures there.
5. Review consent, retention/deletion, rate limits, moderation, storage, and authorization before an external child pilot.

## Limitations

Dashboards, realtime teaching, learning rules, scheduling, uploads, student login, and AI calls are not implemented. Draft consent grants await approval; withdrawals and historical decisions are implemented. The schema establishes boundaries, not complete business workflows. Prerequisite-cycle prevention and full course enrollment validation need deterministic logic in their later phases.

The production audit is clean at verification time. The full audit still reports five high development-only findings in Next ESLint plugin → fast-glob → micromatch → braces. No patched braces version was available. The PostCSS override fixes the runtime finding; do not use `npm audit fix --force` to downgrade the framework. Recheck on updates. See [ADR 0004](docs/architecture/0004-toolchain.md).

Supabase's [database testing guidance](https://supabase.com/docs/guides/local-development/cli/testing-and-linting) describes the pgTAP and SQL lint workflow used here.

## Test the parent flow

1. Start the local Supabase stack and run `npm run dev`.
2. Open http://localhost:3000/auth/sign-up and create a test parent account with a unique email and a password of at least 12 characters.
3. Open the local mail viewer at http://localhost:54324. Choose the verification email and follow its link. Mail stays local; there is no SMTP purchase or external send.
4. Add a student using a nickname, grade, and optional academic goal. Select their profile and edit it.
5. Review separate capability policies. All shipped policies are draft: grants are disabled, and no media or AI capability is active. Record a withdrawal and check the preserved history.
6. Sign out, sign back in, and verify the profiles persist. For recovery, use Forgot password and follow the local recovery email; the updated password should work and the old one should fail.

Local auth uses exact localhost URLs, confirmed emails, 12-character minimum passwords, 15-minute access JWTs, centralized Auth rate limits, and a 60-second email cooldown. After changing `supabase/config.toml`, restart with `npm run db:stop` then `npm run db:start`; restart the app after editing environment variables. Existing `.env.local` files need `APP_ORIGIN=http://localhost:3000` (the setup script supplies it for new files).

For real browser/API integration tests:

```sh
npx playwright install chromium
npm run test:e2e
```

These tests require local Supabase, actual local keys in `.env.local`, and the configured Mailpit templates. They create synthetic local users and profiles; a local `db:reset` removes those fixtures when the data can be discarded. Traces and screenshots are disabled to avoid retaining tokens/passwords. Do not run these fixtures against hosted services. Playwright starts its own dev server; stop other app servers first, and do not run a production build concurrently with browser tests.

## Hosted auth configuration (before any deployment)

- Set `APP_ORIGIN` to the canonical HTTPS application origin. Do not derive email redirects from request Host headers.
- Configure Supabase Site URL and an exact redirect allowlist for that origin; no wildcard production redirects.
- Install the confirmation and recovery templates in `supabase/templates`, replacing SiteURL via Supabase's template variables, so email links reach `/auth/confirm` with the appropriate token hash and type.
- Require confirmed email and at least 12-character passwords; configure token lifetime, secure password changes, custom SMTP, and [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits). The local TOML does not configure hosted projects automatically. Enable CAPTCHA or trusted edge protections if public signup requires additional abuse control.
- Review log redaction for token-bearing URLs in hosting/CDN logs. The local Next configuration ignores auth callback request logging and sends no-referrer/no-store headers.
- Supabase global sign-out revokes refresh sessions, but issued JWTs may remain valid until expiry. Review whether production needs stricter revocation checks.

No hosted project, public deployment, paid service, approved legal policy, or student login is enabled by this work. Founder decisions are listed in [ADR 0006](docs/architecture/0006-consent-foundation.md).
