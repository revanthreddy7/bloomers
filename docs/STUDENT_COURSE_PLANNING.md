# Student enrollment, initial planning and scheduling contracts

## Canonical records

The parent student profile links to an enrollment form and persisted roadmap. A parent selects a published version and explicit scheduling preferences. `enroll_parent_student` resolves the stable course from that publication, derives the confirmed canonical parent actor from `auth.uid()`, locks the relationship/student, and atomically creates:

1. One `student_courses` row for the student/course, pinned to the selected publication, with actor/request metadata and `initialization_state = ready`.
2. Every relevant `student_skills` row, without duplicating or overwriting existing stable skill state.
3. One course-linked record in the existing `availability_preferences` table.
4. One version-pinned `course_plans` row with `algorithm_version = initial-v1`, initially `planned`.
5. Ordered `course_plan_items` segments with skill ID, positive position, lesson position, estimated minutes, objective text, and projected local date.
6. One canonical `lesson_schedules` reservation per projected lesson, linked to plan/lesson position, with UTC start/end and timezone.
7. An initial `schedule_changes` record and metadata-only enrollment audit record.

Any failure rolls back all seven steps. No lesson session, diagnostic assessment, homework or learning evidence is created. `lessons` will remain the later classroom/session record, linked to these schedules when that workflow exists.

The database enforces one student/course enrollment and one plan/lesson-position reservation. Retries with identical normalized preferences and publication return the original enrollment even with a different request UUID. A conflicting publication or preference returns a clear error and leaves existing state fixed. Actor/request reuse for a different target is rejected. Legacy records remain explicitly `legacy`; the new workflow refuses to pretend they are fully initialized.

## Skill initialization

New skills use `mastery_score = 0`, `confidence = 0`, `evidence_count = 0`, no `last_evidence_id`, and `assessment_state = unassessed`. The UI displays **Not yet assessed**, never a failure or mastery percentage from this baseline. A trigger derives `evidenced` only when an evidence count and evidence reference exist. Existing genuine evidence/mastery is preserved on retry or initialization. No diagnostic evidence is fabricated. Future assessment/mastery services must apply evidence provenance and the pinned version's assessment rules.

A stable student/skill row does not claim which curriculum requirements were assessed. The enrollment and historical plans retain exact requirement versions. Future evidence/lesson workflows must capture their publication context explicitly rather than interpreting all old evidence under the catalog's newest requirements.

## Planner `initial-v1`

Validate the complete published structure and version-local DAG. At each step choose the first prerequisite-ready skill in academic unit/topic/skill position order (stable ID tie break). This is a deterministic topological traversal; prerequisites always precede dependents even when an editor's display positions differ.

Assign all estimated instructional minutes. Fill a lesson up to the selected duration, split a skill when needed, and continue with the next eligible skill only after every prerequisite segment has been allocated. Segments retain stable global plan positions. Prerequisite work may finish earlier in the same projected lesson than dependent work. The prototype's 120 estimated minutes produce four 30-minute lessons and seven skill segments. Estimates are planning assumptions, not mastery evidence or duration guarantees. No skills are skipped because they lack assessments; enrollment does not interpret unassessed zero as failed knowledge.

Pure TypeScript functions provide tested domain contracts. PostgreSQL independently generates and persists the canonical result; callers cannot submit a forged plan or precomputed UTC schedule. Current initial planning does not accelerate the course from prior evidence; later diagnostics/mastery work can propose reviewed changes.

## Scheduling preferences and DST

`features/planning/schema.ts` defines strict configuration: schema version, IANA timezone (or UTC), duration 20–90 minutes, frequency 1–7/week, one explicit time per selected weekday, and a real earliest date. Frequency must equal slot count. Unknown keys, duplicate weekdays, invalid dates, invalid times and unknown zones are rejected. The form provides editable defaults for duration/frequency; timezone, date, weekday and time are blank until selected.

Recurrence advances calendar dates in the chosen timezone, rather than adding seven fixed 24-hour periods to an existing UTC instant. Elapsed slots on the allowed starting day are skipped. The first date must be today or within the next 365 local days. Projection supports up to 200 lessons within a 730-day horizon. The complete chosen recurrence is required; a conflict rejects enrollment instead of silently skipping or moving a parent's preferred lesson.

**DST policy:** Reject every nonexistent spring-forward local time and every ambiguous fall-back local time. Users must select another time. Both TypeScript and PostgreSQL collect distinct nearby IANA offsets, round-trip candidate instants, and require exactly one match. This handles half-hour transitions as well as typical one-hour changes. Lesson end is elapsed UTC duration; a session crossing a transition can display a different local clock span while preserving actual duration.

PostgreSQL normally supplies a default interpretation for [invalid/ambiguous timestamps](https://www.postgresql.org/docs/16/datetime-invalid-input.html); this workflow deliberately validates before accepting an instant. Canonical overlap protection uses [range exclusion constraints](https://www.postgresql.org/docs/17/rangetypes.html) and `btree_gist`: the same student's non-cancelled reservations cannot overlap, while touching endpoints are allowed. Existing schedule rows from earlier phases lacked duration; the additive migration assigns a 30-minute end time. If imported legacy reservations already overlap, migration fails for operator review rather than quietly changing their starts.

## Retrieval and authorization

`server/planning/service.ts` resolves the student, enrollment, exact publication, plan, saved preferences, ordered items, canonical schedules, and student skill states using the authenticated SSR client and existing RLS. URL student/enrollment pairs must match. Parents cannot see another family's records; students' database reads remain limited to their own records, and parent UI/RPCs require the PARENT role. An ADMIN role does not bypass child-data RLS.

The roadmap displays ordered units/topics, skills, prerequisites, persistent lesson sequence, upcoming reservations, timezone, reserved duration, estimated instructional work and completion, curriculum/plan versions, and explicit planned/in-progress/completed labels based on canonical status. It does not derive completed progress from guessed mastery. Refreshes return the same identifiers and dates. Publishing a new curriculum version changes neither enrollment nor plan nor reservation.

## Future personalization interfaces

`features/planning/contracts.ts` separates student-course state, publication pins, stable skill states, ordered plan items, preferences, schedules, and future schedule-change proposals. Proposals carry the expected plan version, evidence/homework references, reason/trigger, affected stable schedule IDs, proposed instants and approval requirement.

**The course is stable; the student's schedule is dynamic.** Future deterministic services must authorize the student, retain academic requirement pins, validate relevant assessment/homework evidence, lock the student/plan, validate timezone/overlap constraints, apply the appropriate reviewed approval policy, and append an audit/change record before committing. Prior plans and lesson/evidence version references remain historical facts. Maya may propose actions through validated tools later; it never writes schedule/mastery directly.

Adaptive recalculation for mastery, missed lessons and homework belongs to Phase 9. Initial schedule editing, enrollment cancellation, migration to another publication, notifications, classroom sessions and Maya integration are not enabled in Phase 3.
