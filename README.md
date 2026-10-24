# Bloomers V1 — Phase 6

Verified foundation plus parent identity: signup, verified email, sign-in/out, password recovery, protected parent pages, student profiles, and versioned consent decisions. Phase 2 adds a versioned curriculum engine and authenticated read-only explorer. Phase 3 adds atomic course enrollment, unassessed skill initialization, deterministic plans and timezone-aware schedules, and persistent student roadmaps. Phase 4 connects these records through parent learning views and a supervised, session-scoped student preview. Phase 5 adds the durable supervised classroom. Phase 6 adds deterministic mock Maya teaching with coordinated board actions and inactive OpenAI/WebRTC adapters. Live AI and the three-lesson pilot remain gated. `/api/health` checks liveness, not database readiness.

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
npm run db:test:seed
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
| `npm run db:test:seed`                        | Verify repeatable local seed without persisting changes       |
| `npm run db:test`                             | pgTAP authorization and constraint tests                      |
| `npm audit --omit=dev --audit-level=moderate` | Production dependency audit                                   |

See the [Phase 0 report](docs/PHASE_0_VERIFICATION.md), [Phase 1 report](docs/PHASE_1_VERIFICATION.md), [Phase 2 report](docs/PHASE_2_VERIFICATION.md), [Phase 3 report](docs/PHASE_3_VERIFICATION.md), and [Phase 4 report](docs/PHASE_4_VERIFICATION.md) for actual results. CI uses clean installs, application checks/build, a production audit, and a separate Supabase reset/lint/test job. GitHub execution requires pushing the repository and has not been observed locally.

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

Identity, curriculum and initial planning now use focused domain/feature modules. Future learning, adaptive scheduling, lesson, assessment, homework, memory, reporting, and AI services should follow those boundaries. UI calls authorized application services; deterministic services validate AI proposals before writing. Empty scaffolding and pretend implementations are intentionally absent. Read the [build brief](docs/BLOOMERS_V1_BUILD_BRIEF.md) before expanding scope.

## Database and authorization

The initial migration creates 41 domain tables. An additive hardening migration restricts client privileges, adds constraints and FK indexes, and opens audited read policies. The seed provides five Grade 8 mathematics skills, five prerequisites, assessment metadata, and five private questions. It creates no student accounts.

Parents read linked students; students read their own records. Nested records follow parent-row RLS. All direct browser table writes remain denied. Verified parents can invoke narrowly authorized identity RPCs to create/edit linked students and append consent decisions. Actors are derived from validated JWTs, never caller-provided parent IDs. Privileged learning state remains unwritable. A canonical verified ADMIN may invoke the narrow curriculum draft/publish RPCs and inspect academic drafts; it grants no child-data bypass. Raw lesson events/messages, question answers, memory, uploads, and operations have no client read policies. Parent reports are parent-only. Storage buckets and media collection are not provisioned.

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

Parent learning views and the supervised student preview are implemented. Live voice/AI, assessed mastery rules, adaptive scheduling, uploads and independent student login remain gated or planned. Mock Maya teaching is functional and creates no learning credit. Draft consent grants await approval; withdrawals and historical decisions are implemented. Version-scoped prerequisite graphs reject cycles, and enrollment/plan version pins prevent automatic curriculum transitions. Initial enrollment and scheduling are implemented; evidence-based personalization and adaptive recalculation remain later work.

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

## Explore the curriculum

Sign in as a verified parent, then choose **Curriculum** or visit [localhost:3000/curriculum](http://localhost:3000/curriculum). Open Grade 8 Mathematics to inspect published version 1, Algebra → Linear Equations, the five stable skills, objectives, prerequisites, worked examples, and whiteboard demonstrations. Parents cannot see drafts or private question answers. Canonically provisioned, verified academic administrators sign in to the same explorer; this phase creates no real administrator account or authoring UI.

Published snapshots are immutable. Draft saves use revision checks; publication is explicit, validated, and audited. Students and historical course plans retain their selected version. A new publication does not migrate students. `npm run db:test:seed` replays the sample seed twice inside a rolled-back local Docker/PostgreSQL transaction and verifies that catalog, questions, publications, and audit history stay unchanged. CI runs this check too.

Read [Curriculum foundation](docs/CURRICULUM_FOUNDATION.md), [ADR 0007](docs/architecture/0007-versioned-curriculum.md), and [Maya Teaching Studio contract](docs/MAYA_TEACHING_STUDIO_CONTRACT.md) for schemas, service contracts, future editor workflows, and controlled student migration. Course documents are bounded atomic JSON snapshots, validated by Zod and PostgreSQL pg_jsonschema. Keep the checked-in schema, migration validator, sample fixture, and seed aligned; tests enforce this. New document schema versions require additive migrations.

The Phase 2 migration intentionally fails if an existing installation has unversioned enrollments without a reviewed legacy snapshot. The Phase 1 baseline had no enrollment workflow. Prepare a reviewed snapshot/backfill before applying to such an installation; never fabricate historical requirements or reset hosted data. Studio editing, upload ingestion, teaching-policy activation, LLM integration, and adaptive planning are future work.

## Enroll and view a learning roadmap

1. Sign in as a verified parent and choose an existing student (or create one).
2. Choose **Enroll in a course**, then Grade 8 Mathematics, published version 1.
3. Enter an IANA timezone such as `America/New_York`, select weekdays and local lesson time, and choose an earliest date within the next year. The number of selected weekdays must equal lessons/week. Duration 30 minutes and frequency two/week are editable defaults; availability is never assumed.
4. Confirm enrollment. The transaction creates all relevant student skills, a version-pinned plan, preferences, lesson reservations, and audit records together. An overlap or invalid DST time creates no partial enrollment.
5. Review the student's persistent roadmap: four projected lessons for the prototype at 30 minutes, skills marked **Not yet assessed**, timezone-aware dates, prerequisites, and estimated completion. Refresh or return through **View course roadmap** on the student profile.

Publishing another curriculum version never rewrites this enrollment or schedule. Identical retries return the same records; changed preferences/version cannot silently replace them. Nonexistent and ambiguous DST local times are rejected, so select another time. Initial schedule editing and adaptive recalculation are not yet enabled. No consent-gated media or AI capability is activated by enrollment.

Read [Student course planning](docs/STUDENT_COURSE_PLANNING.md), [ADR 0008](docs/architecture/0008-initial-course-planning.md), and the [Phase 3 verification report](docs/PHASE_3_VERIFICATION.md). The canonical existing enrollment/planning/scheduling tables are reused; legacy incomplete enrollments require reviewed initialization. Run SQL assertions on a clean local seed **before** browser tests create synthetic records.

## Parent application and student preview

Sign in and choose a student using **Selected student**. Navigate Overview, Course, Progress, Homework, Schedule and Settings. Existing student cards/profiles, enrollment and curriculum links remain available. Course uses the pinned publication and persisted roadmap; Schedule displays real UTC reservations in the selected course timezone with previous/current/next weeks. Newly enrolled skills remain **Not yet assessed**. Attendance and homework are empty until actual records exist; there are no invented percentages, assignments or AI insights.

Choose **Open student preview** from a student's overview. Home, Course, Homework and Progress show that student's read-only learning space. A visible banner identifies the parent-assisted session. The database narrows the current parent session to one student and denies parent mutations; sibling selection, settings and consent views are inaccessible. Refresh preserves this scope. Choose **Return to parent mode**, then **I’m the parent — continue**, to restore parent context and switching.

Keep the guardian present. This supervised preview retains parent authentication and is not a secure unattended device handoff or child login. Its return button is not guardian authentication. Close other parent tabs before preview. Future independent student access requires reviewed limited credentials, guardian return authentication and consent/eligibility decisions; no student credentials are created now. No voice, camera, uploads, avatar or AI is activated. Phase 5 adds the supervised classroom rehearsal described below.

See [application view contracts and navigation](docs/APPLICATION_SHELL.md), [preview architecture ADR](docs/architecture/0009-application-shell-and-student-preview.md), and [Phase 4 verification](docs/PHASE_4_VERIFICATION.md).

## Supervised classroom rehearsal

From **Open student preview**, open **Open supervised classroom preview** for an upcoming lesson, then **Start classroom preview**. The classroom shows the canonical course/topic/objectives and exact plan/publication versions. Draw with the pen, use whole-stroke eraser, undo/redo, or confirmed clear; refresh to recover saved work. Pause disables drawing, Resume reopens it, and End saves a terminal read-only rehearsal. **Return to parent mode** explicitly abandons an unfinished rehearsal and restores parent navigation.

Future reservations can be rehearsed early; expired or cancelled reservations cannot start. This is parent-assisted practice, with no attendance credit, learning outcomes, mastery updates or schedule changes. Keep the parent present. Microphone, camera, uploads and live Maya remain visibly disabled. Polling/replay is functional; Phase 6 adds the explicitly labeled mock teaching simulation below. Read [classroom architecture/protocol](docs/CLASSROOM_INFRASTRUCTURE.md), [ADR 0010](docs/architecture/0010-supervised-classroom-and-event-timeline.md) and [Phase 5 verification](docs/PHASE_5_VERIFICATION.md).

## Mock Maya teaching

Open the first upcoming Grade 8 Mathematics classroom in supervised preview. Choose **Start classroom preview**, **Start Maya simulation**, then **Continue Maya simulation**. Read the simulated narration while the whiteboard demonstrates signed integer addition. Choose **Next teaching step** to continue, **Interrupt Maya** to cancel a pending demonstration, and Continue to recover. Ask for a simulated hint or response, refresh to recover committed board work, and **Stop Maya simulation** or End to finish. Keep the parent present.

This is scripted text, not spoken audio. No external requests, microphone/camera capture, paid usage, assessment, attendance, homework or schedule changes occur. Reviewed scripts support Integer arithmetic and Inverse operations when they are the first planned skill; unsupported lessons display an unavailable message. The backend enforces a five-minute simulation limit, strict tool/event schemas, scoped idempotent operations and bounded rates/history.

OpenAI SDK 7.32.0 and server-only Realtime/structured-planning adapters were added in Phase 6. The student preview remains mock-only. Phase 6.5 adds the separate adult developer console below; no provider API credential is returned to browsers. A key, ordinary parent/ADMIN role or enable flag alone cannot activate live AI. No real child context may be sent externally. See [Maya integration](docs/MAYA_INTEGRATION.md), [ADR 0011](docs/architecture/0011-maya-simulation-and-inactive-provider.md) and [Phase 6 verification](docs/PHASE_6_VERIFICATION.md).

## Adult developer Maya checkpoint

`/developer/maya` is an internal, local-development-only synthetic Grade 8 conversation classroom. Access requires an operator-authored Auth UUID allowlist, verified retained Auth session and no active student preview. Live start additionally requires a current one-session founder-approved configuration and explicit adult microphone opt-in. Live AI stays disabled by default; Stage A tests never call paid endpoints.

With other app servers stopped, run `npm run test:maya:development` to verify a synthetic allowlisted developer can open the console with microphone OFF and paid-start disabled, while ordinary parent access remains denied. It also exercises the real UI with browser-only mocked voice/board responses and no Next/Continue controls. The script forces live flags off, cleans its synthetic Auth account/credential file and stops its app process. Build/type generation must run separately from browser development servers.

The server owns call creation, sideband tools, cancellation, duration/concurrency and estimated-usage termination. No hard provider spending cap is claimed. Before any live activation, review [the exact approval and operational requirements](docs/MAYA_DEVELOPMENT.md), [teaching rubrics](docs/MAYA_TEACHING_EVALUATION.md), [ADR 0012](docs/architecture/0012-adult-development-call-control.md) and [Phase 6.5 verification](docs/PHASE_6_5_VERIFICATION.md). No child pilot or Phase 7 workflow is enabled.

For local enrollment investigation only, `ENROLLMENT_TRACE=1` emits stage/status/duration metadata without IDs, request bodies or secrets. Temporary Auth failures now produce retryable errors rather than redirecting through sign-in; invalid/missing sessions remain denied. Historical intermittent enrollment delays are not declared fixed solely by passing retries.

The Stage B repair adds a browser-connected ready handshake, teacher-selected validated board actions, spoken-turn progression and pause/resume with retained deadline enforcement. Allowlisted adults see **Live Maya · adult test** in parent navigation; the student-preview classroom continues to use its labeled simulation. See [teaching repair verification](docs/PHASE_6_5_TEACHING_REPAIR.md) for executed checks and pending audible validation. Prior failed live attempts remain failures; a new paid adult test needs explicit approval.

For a failed adult Realtime experiment with an uncertain hangup, follow the [Maya session recovery runbook](docs/MAYA_SESSION_RECOVERY.md). Policy expiry is distinct from provider-confirmed termination; recovery never authorizes a new paid call.
