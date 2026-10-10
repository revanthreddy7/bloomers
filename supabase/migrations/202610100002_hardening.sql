-- Explicit privileges complement RLS. No client writes in Phase 0.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke create on schema public from public, anon, authenticated;
-- Later migrations must explicitly open access for every new table/function.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
revoke all on function public.is_parent_of(uuid) from public, anon;
grant execute on function public.is_parent_of(uuid) to authenticated, service_role;

create function public.can_read_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.student_profiles s
    where s.id = p_student and (s.user_id = (select auth.uid()) or public.is_parent_of(s.id))
  )
$$;
revoke all on function public.can_read_student(uuid) from public, anon;
grant execute on function public.can_read_student(uuid) to authenticated, service_role;

-- Identity links and role changes can only be provisioned by a trusted service.
alter table public.users add constraint users_id_role_key unique (id, role);
alter table public.parent_profiles add column role public.app_role not null default 'PARENT' check (role = 'PARENT');
alter table public.parent_profiles add constraint parent_role_fk foreign key (user_id, role) references public.users(id, role);
alter table public.student_profiles add column role public.app_role not null default 'STUDENT' check (role = 'STUDENT');
alter table public.student_profiles add constraint student_role_fk foreign key (user_id, role) references public.users(id, role);
alter table public.consents add constraint consent_relationship_fk foreign key (parent_id, student_id) references public.parent_student_relationships(parent_id, student_id);
create index relationships_student_idx on public.parent_student_relationships(student_id);

alter table public.units add constraint units_position_positive check (position > 0), add constraint units_position_key unique (course_id, position);
alter table public.topics add constraint topics_position_positive check (position > 0), add constraint topics_position_key unique (unit_id, position);
alter table public.skills add constraint mastery_threshold_range check (mastery_threshold > 0 and mastery_threshold <= 1);
alter table public.skills add column description text not null default '', add column difficulty integer not null default 1 check (difficulty between 1 and 5), add column estimated_minutes integer not null default 20 check (estimated_minutes > 0), add column assessment_rules jsonb not null default '{}';
alter table public.course_plans add constraint course_plan_version_positive check (version > 0), add constraint course_plan_version_key unique (student_course_id, version);
alter table public.course_plan_items add constraint plan_position_positive check (position > 0), add constraint plan_position_key unique (course_plan_id, position);
alter table public.lesson_schedules add constraint schedule_status check (status in ('scheduled', 'completed', 'cancelled', 'missed')), add constraint schedule_id_student_key unique (id, student_id);
alter table public.lessons add constraint lesson_status check (status in ('planned', 'active', 'completed', 'cancelled')), add constraint lesson_time_order check (ended_at is null or (started_at is not null and ended_at >= started_at)), add constraint lesson_id_student_key unique (id, student_id), add constraint lesson_schedule_owner_fk foreign key (schedule_id, student_id) references public.lesson_schedules(id, student_id);
alter table public.homework_assignments add constraint homework_lesson_owner_fk foreign key (lesson_id, student_id) references public.lessons(id, student_id);
alter table public.homework_items add constraint homework_question_key unique (assignment_id, question_id);
alter table public.schedule_changes add column trigger text not null default 'unspecified', add column actor_id uuid references public.users(id);
alter table public.student_skills add column confidence numeric(4,3) not null default 0 check (confidence between 0 and 1), add column evidence_count integer not null default 0 check (evidence_count >= 0), add column last_practiced timestamptz, add column next_review timestamptz;
alter table public.learning_evidence add constraint evidence_id_student_skill_key unique (id, student_id, skill_id);
alter table public.student_skills add column last_evidence_id uuid;
alter table public.student_skills add constraint mastery_evidence_owner_fk foreign key (last_evidence_id, student_id, skill_id) references public.learning_evidence(id, student_id, skill_id);
alter table public.student_skills add constraint nonzero_mastery_needs_evidence check (mastery_score = 0 or (last_evidence_id is not null and evidence_count > 0));

-- Index every FK whose leading columns are not already indexed (including
-- ownership chains used by policies). Composite FK columns are indexed together.
do $$
declare fk record;
begin
  for fk in
    select c.conrelid, c.conkey, c.conname,
      string_agg(quote_ident(a.attname), ', ' order by k.ordinality) as columns
    from pg_constraint c
    cross join lateral unnest(c.conkey) with ordinality k(attnum, ordinality)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i where i.indrelid = c.conrelid and i.indisvalid
        and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] = c.conkey
      )
    group by c.conrelid, c.conkey, c.conname
  loop
    execute format('create index %I on %s (%s)', left(fk.conname, 55) || '_idx', fk.conrelid::regclass, fk.columns);
  end loop;
end $$;

-- Read access follows canonical student ownership. Questions/answers, raw
-- messages, memory, uploads and operations stay inaccessible to client roles.
create policy "authorized student read" on public.student_courses for select to authenticated using (public.can_read_student(student_id));
create policy "authorized student read" on public.student_skills for select to authenticated using (public.can_read_student(student_id));
create policy "authorized student read" on public.student_misconceptions for select to authenticated using (public.can_read_student(student_id));
create policy "authorized student read" on public.learning_evidence for select to authenticated using (public.can_read_student(student_id));
create policy "authorized student read" on public.lesson_schedules for select to authenticated using (public.can_read_student(student_id));
create policy "authorized student read" on public.schedule_changes for select to authenticated using (public.can_read_student(student_id));
create policy "authorized student read" on public.availability_preferences for select to authenticated using (public.can_read_student(student_id));
create policy "authorized student read" on public.lessons for select to authenticated using (public.can_read_student(student_id));
create policy "authorized student read" on public.homework_assignments for select to authenticated using (public.can_read_student(student_id));
create policy "authorized student read" on public.parent_reports for select to authenticated using (public.is_parent_of(student_id));
create policy "authorized chain read" on public.course_plans for select to authenticated using (exists (select 1 from public.student_courses c where c.id = student_course_id));
create policy "authorized chain read" on public.course_plan_items for select to authenticated using (exists (select 1 from public.course_plans p where p.id = course_plan_id));
create policy "authorized chain read" on public.lesson_plans for select to authenticated using (exists (select 1 from public.lessons l where l.id = lesson_id));
create policy "authorized chain read" on public.lesson_outcomes for select to authenticated using (exists (select 1 from public.lessons l where l.id = lesson_id));
create policy "authorized chain read" on public.session_summaries for select to authenticated using (exists (select 1 from public.lessons l where l.id = lesson_id));
create policy "authorized chain read" on public.homework_items for select to authenticated using (exists (select 1 from public.homework_assignments a where a.id = assignment_id));
create policy "authorized chain read" on public.homework_submissions for select to authenticated using (exists (select 1 from public.homework_assignments a where a.id = assignment_id));
create policy "authorized chain read" on public.homework_results for select to authenticated using (exists (select 1 from public.homework_submissions s where s.id = submission_id));
create policy "authorized chain read" on public.student_attempts for select to authenticated using (public.can_read_student(student_id));
create policy "authorized chain read" on public.assessment_results for select to authenticated using (exists (select 1 from public.student_attempts a where a.id = attempt_id));

-- Service-side mutations will be implemented in later phases. Public storage
-- access is deliberately not provisioned; no buckets or object policies yet.
