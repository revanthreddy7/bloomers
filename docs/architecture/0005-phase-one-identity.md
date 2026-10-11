# ADR 0005 — Verified parent identity and scoped mutations

**Decision:** Use Supabase SSR cookies, server-validated sessions, and narrowly authorized PostgreSQL functions for parent identity workflows.

**Options:** Browser-only sessions; server services using blanket service-role access; authenticated SSR clients invoking transaction-scoped, actor-derived database operations.

**Recommendation:** Use the third option. Next.js 15 middleware refreshes cookies with verified claims; protected routes and actions retrieve the current user from Auth. The database requires a confirmed email and the application PARENT role for writes. No identity mutation uses the service-role client.

**Why:** RLS protects reads, while security-definer functions allow only the intended write, using `auth.uid()` rather than supplied parent IDs. Provisioning is atomic and repeatable; it never accepts role metadata or changes a STUDENT/ADMIN into PARENT. Student creation writes the profile and relationship in one transaction, with a per-parent request UUID and advisory lock. The browser can invoke these RPCs directly, so authorization, validation, idempotency, and throttling also execute inside the database. Direct table writes remain denied.

**Tradeoffs:** Auth validation incurs an Auth request; idempotent provisioning runs on protected requests and is cached within a render. Successfully committed identity mutations are limited to 30 per parent per minute using transaction locks and metadata-only audit records. This is not a general network/DDoS control. Supabase Auth supplies centralized auth limits; hosted deployment additionally needs appropriate SMTP, configured rate limits, optional CAPTCHA, and trusted edge protections. Never trust forwarded IP headers from an untrusted request.

**Reversibility:** Future services can wrap these operations; do not expose the service key to solve client permissions. New role provisioning remains a reviewed backend workflow.

**Sessions and redirects:** Session cookies are verified, never trusted via `getSession()` alone. Authenticated responses are private/no-store. Redirects are allowlisted parent paths, and the operator supplies `APP_ORIGIN` for outbound emails. Custom confirmation and recovery templates use one-time token hashes; only email/signup/recovery token types are accepted. Token-bearing callback paths are excluded from development request logging and use no-referrer headers. Password updates act only on the Auth-validated user and revoke refresh sessions globally. Supabase access JWTs can remain valid until expiration after global sign-out; cookie removal prevents continued access in the signed-out browser. Public deployment must review access-token lifetime and session-revocation requirements.

**Student access:** Phase 1 creates parent-managed profiles with no `auth.users` login. The supported fields are display name, grade 1–12, and optional academic goals, not birthdate, address, medical history, or school identifiers. Grade is a course-placement input, not evidence of age or legal eligibility.

Future options requiring founder approval:

1. Parent-assisted, short-lived student sessions, bound server-side to a linked student and limited to student permissions.
2. A separately provisioned student Auth identity after an approved age/consent policy, atomically linked to one profile by a trusted backend.

Do not share a parent password or automatically issue minor credentials. A URL or selected profile alone must never establish a student session. Profile selection in Phase 1 is simply navigation to a freshly authorized parent view.

**Verification:** Unit/service tests, actual Auth/REST browser integration, concurrent retries, pgTAP with both families, and all unchanged Phase 0 checks.
