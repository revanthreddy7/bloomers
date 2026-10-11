-- Atomic enrollment, unknown skill state, academic plan and UTC reservations.
create extension if not exists btree_gist with schema extensions;
create function public.initial_preferences_schema() returns json language sql immutable set search_path = '' as $schema$ select $json${"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"schemaVersion":{"type":"number","const":1},"timezone":{"type":"string","minLength":1,"maxLength":100,"pattern":"^(UTC|[A-Za-z_+-]+\\/[A-Za-z0-9_+\\/-]+)$"},"lessonDurationMinutes":{"type":"integer","minimum":20,"maximum":90},"weeklyFrequency":{"type":"integer","minimum":1,"maximum":7},"slots":{"minItems":1,"maxItems":7,"type":"array","items":{"type":"object","properties":{"weekday":{"type":"integer","minimum":0,"maximum":6},"time":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"}},"required":["weekday","time"],"additionalProperties":false}},"earliestDate":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$"}},"required":["schemaVersion","timezone","lessonDurationMinutes","weeklyFrequency","slots","earliestDate"],"additionalProperties":false}$json$::json $schema$;

alter table public.student_courses add column enrolled_by uuid references public.users(id), add column creation_request_id uuid,
 add column initialization_state text not null default 'legacy' check(initialization_state in ('legacy','ready')),
 add column status text not null default 'active' check(status in ('active','completed')),
 add constraint enrollment_request_key unique(enrolled_by,creation_request_id);
create index student_course_actor_idx on public.student_courses(enrolled_by);
alter table public.student_skills add column assessment_state text not null default 'unassessed' check(assessment_state in ('unassessed','evidenced'));
update public.student_skills set assessment_state='evidenced' where evidence_count>0;
-- Zero is a storage baseline, never a claim of observed failure or mastery.
create function public.sync_skill_assessment_state() returns trigger language plpgsql set search_path='' as $$
begin
 new.assessment_state := case when new.evidence_count>0 and new.last_evidence_id is not null then 'evidenced' else 'unassessed' end;
 return new;
end $$;
create trigger sync_skill_assessment_state before insert or update on public.student_skills for each row execute function public.sync_skill_assessment_state();
alter table public.course_plans add column algorithm_version text, add column status text not null default 'planned' check(status in ('planned','active','completed'));
alter table public.availability_preferences add column student_course_id uuid unique references public.student_courses(id);
alter table public.course_plan_items add column estimated_minutes integer check(estimated_minutes between 1 and 90),
 add column lesson_position integer check(lesson_position>0), add column objectives jsonb not null default '[]' check(jsonb_typeof(objectives)='array');
alter table public.lesson_schedules add column ends_at timestamptz, add column timezone text,
 add column course_plan_id uuid references public.course_plans(id),add column lesson_position integer check(lesson_position>0);
update public.lesson_schedules set ends_at=starts_at+interval '30 minutes';
alter table public.lesson_schedules alter column ends_at set not null;
alter table public.lesson_schedules add constraint schedule_time_order check(ends_at>starts_at),
 add constraint schedule_plan_position_key unique(course_plan_id,lesson_position),
 add constraint student_reservations_do_not_overlap exclude using gist(student_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status<>'cancelled');
alter table public.course_plan_items add constraint plan_item_schedule_fk foreign key(course_plan_id,lesson_position) references public.lesson_schedules(course_plan_id,lesson_position);

create function public.validate_initial_preferences(p jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare start_day date; normalized jsonb;
begin
 if p is null or not extensions.jsonb_matches_schema(public.initial_preferences_schema(),p) then raise exception 'Invalid scheduling preferences' using errcode='22023'; end if;
 if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Unknown timezone' using errcode='22023'; end if;
 if (p->>'weeklyFrequency')::integer<>jsonb_array_length(p->'slots') or exists(select 1 from jsonb_array_elements(p->'slots') slot group by slot->>'weekday' having count(*)>1) then raise exception 'Select exactly one time per weekday' using errcode='22023'; end if;
 begin start_day := (p->>'earliestDate')::date; exception when others then raise exception 'Invalid starting date' using errcode='22023'; end;
 if to_char(start_day,'YYYY-MM-DD')<>p->>'earliestDate' then raise exception 'Invalid starting date' using errcode='22023'; end if;
 select jsonb_agg(slot order by (slot->>'weekday')::integer) into normalized from jsonb_array_elements(p->'slots') slot;
 return jsonb_set(p,'{slots}',normalized);
end $$;

-- Round-trip every distinct nearby zone offset. Exactly one instant is required.
-- Reject gaps and folds rather than silently applying PostgreSQL's default DST interpretation.
create function public.resolve_initial_local_time(p_local timestamp,p_timezone text) returns timestamptz language plpgsql stable set search_path='' as $$
declare candidate timestamptz; matches integer;
begin
 if p_local is null or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Unknown local time or timezone' using errcode='22023'; end if;
 with offsets as (
  select distinct (probe at time zone p_timezone)-(probe at time zone 'UTC') as utc_offset
  from generate_series((p_local at time zone 'UTC')-interval '48 hours',(p_local at time zone 'UTC')+interval '48 hours',interval '12 hours') probe
 ), candidates as (
  select (p_local-utc_offset) at time zone 'UTC' as instant from offsets
 ) select count(*)::integer,min(instant) into matches,candidate from candidates where instant at time zone p_timezone=p_local;
 if matches<>1 then raise exception 'Local time is ambiguous or nonexistent; choose another time' using errcode='P3001'; end if;
 return candidate;
end $$;

create function public.build_initial_course_plan(d jsonb,p_duration integer) returns jsonb language plpgsql set search_path='' as $$
declare ordered jsonb; selected jsonb; completed uuid[] := array[]::uuid[]; all_ids uuid[]; skill_id uuid;
 items jsonb := '[]'::jsonb; lesson integer := 1; capacity integer; minutes integer; allocated integer; total integer := 0;
begin
 perform public.validate_curriculum_document(d,true);
 if p_duration is null or p_duration<20 or p_duration>90 then raise exception 'Invalid lesson duration' using errcode='22023'; end if;
 capacity := p_duration;
 select jsonb_agg(s order by (u->>'position')::integer,(t->>'position')::integer,(s->>'position')::integer,s->>'id'),array_agg((s->>'id')::uuid) into ordered,all_ids
 from jsonb_array_elements(d->'units') u cross join lateral jsonb_array_elements(u->'topics') t cross join lateral jsonb_array_elements(t->'skills') s;
 while cardinality(completed)<cardinality(all_ids) loop
  select entry into selected from jsonb_array_elements(ordered) with ordinality entries(entry,rank)
  where not (entry->>'id')::uuid=any(completed) and not exists(
   select 1 from jsonb_array_elements(d->'prerequisites') edge where edge->>'skillId'=entry->>'id' and not (edge->>'prerequisiteId')::uuid=any(completed)) order by rank limit 1;
  if selected is null then raise exception 'Invalid prerequisite graph' using errcode='22023'; end if;
  skill_id := (selected->>'id')::uuid; minutes := (selected->>'estimatedMinutes')::integer;
  total := total+minutes;
  while minutes>0 loop
   if capacity=0 then lesson := lesson+1; capacity := p_duration; end if;
   if lesson>200 then raise exception 'Course exceeds 200 projected lessons' using errcode='22023'; end if;
   allocated := least(capacity,minutes);
   items := items||jsonb_build_array(jsonb_build_object('position',jsonb_array_length(items)+1,'skillId',skill_id,'lessonPosition',lesson,'estimatedMinutes',allocated,'objectives',jsonb_build_array(selected->>'description')));
   capacity := capacity-allocated; minutes := minutes-allocated;
  end loop;
  completed := array_append(completed,skill_id);
 end loop;
 return jsonb_build_object('algorithmVersion','initial-v1','items',items,'lessonCount',lesson,'totalEstimatedMinutes',total);
end $$;

create function public.build_initial_lesson_schedule(p jsonb,p_count integer,p_now timestamptz) returns jsonb language plpgsql stable set search_path='' as $$
declare preferences jsonb := public.validate_initial_preferences(p); start_day date; today date; day date; slot jsonb;
 instant timestamptz; projected jsonb := '[]'::jsonb;
begin
 if p_count is null or p_count<1 or p_count>200 or p_now is null then raise exception 'Invalid schedule inputs' using errcode='22023'; end if;
 start_day := (preferences->>'earliestDate')::date; today := (p_now at time zone (preferences->>'timezone'))::date;
 if start_day<today or start_day>today+365 then raise exception 'Starting date must be within the next year' using errcode='22023'; end if;
 for offset_day in 0..730 loop
  exit when jsonb_array_length(projected)=p_count;
  day := start_day+offset_day;
  for slot in select value from jsonb_array_elements(preferences->'slots') where (value->>'weekday')::integer=extract(dow from day)::integer loop
   instant := public.resolve_initial_local_time(day+(slot->>'time')::time,preferences->>'timezone');
   if instant<=p_now then continue; end if;
   projected := projected||jsonb_build_array(jsonb_build_object('position',jsonb_array_length(projected)+1,'startsAt',instant,'endsAt',instant+make_interval(mins=>(preferences->>'lessonDurationMinutes')::integer),'timezone',preferences->>'timezone','localDate',day,'localTime',slot->>'time'));
  end loop;
 end loop;
 if jsonb_array_length(projected)<>p_count then raise exception 'Schedule exceeds two-year horizon' using errcode='22023'; end if;
 return projected;
end $$;

create function public.guard_planned_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
 if new.ends_at is null then new.ends_at := new.starts_at+interval '30 minutes'; end if;
 if (new.course_plan_id is null)<>(new.lesson_position is null) then raise exception 'Plan and lesson position are required together' using errcode='22023'; end if;
 if new.course_plan_id is not null then
  select sc.student_id into owner from public.course_plans cp join public.student_courses sc on sc.id=cp.student_course_id where cp.id=new.course_plan_id;
  if owner is distinct from new.student_id then raise exception 'Schedule belongs to another student' using errcode='23503'; end if;
  if new.timezone is null or not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Scheduled plan needs a timezone' using errcode='22023'; end if;
 end if;
 return new;
end $$;
create trigger guard_planned_reservation before insert or update on public.lesson_schedules for each row execute function public.guard_planned_reservation();

create function public.guard_enrollment_preferences() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.student_course_id is not null then
  if not exists(select 1 from public.student_courses where id=new.student_course_id and student_id=new.student_id) then raise exception 'Availability belongs to another student' using errcode='23503'; end if;
  new.preferences := public.validate_initial_preferences(new.preferences);
 end if;
 return new;
end $$;
create trigger guard_enrollment_preferences before insert or update on public.availability_preferences for each row execute function public.guard_enrollment_preferences();

create function public.guard_initial_plan_item() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb;
begin
 if new.lesson_position is not null then
  select v.document into d from public.course_plans cp join public.curriculum_versions v on v.id=cp.curriculum_version_id where cp.id=new.course_plan_id;
  if new.estimated_minutes is null or not exists(select 1 from jsonb_array_elements(d->'units') u cross join lateral jsonb_array_elements(u->'topics') t cross join lateral jsonb_array_elements(t->'skills') s where (s->>'id')::uuid=new.skill_id) then raise exception 'Plan skill outside pinned curriculum' using errcode='23503'; end if;
 end if;
 return new;
end $$;
create trigger guard_initial_plan_item before insert or update on public.course_plan_items for each row execute function public.guard_initial_plan_item();

create function public.enroll_parent_student(p_request_id uuid,p_student_id uuid,p_version_id uuid,p_preferences jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := public.require_verified_parent(); resolved_preferences jsonb; publication public.curriculum_versions; existing public.student_courses;
 enrollment uuid; plan uuid; academic jsonb; calendar jsonb; entry jsonb;
begin
 if p_request_id is null or p_student_id is null or p_version_id is null then raise exception 'Invalid enrollment inputs' using errcode='22023'; end if;
 perform 1 from public.parent_student_relationships where parent_id=actor and student_id=p_student_id for share;
 if not found then raise exception 'Student is not authorized' using errcode='42501'; end if;
 -- One student lock serializes all courses and guardians, preventing cross-course races.
 perform 1 from public.student_profiles where id=p_student_id for update;
 resolved_preferences := public.validate_initial_preferences(p_preferences);
 select * into publication from public.curriculum_versions where id=p_version_id and status='published';
 if not found then raise exception 'A published curriculum version is required' using errcode='22023'; end if;
 select * into existing from public.student_courses where enrolled_by=actor and creation_request_id=p_request_id;
 if found and (existing.student_id<>p_student_id or existing.curriculum_version_id<>p_version_id) then raise exception 'Request already used for different enrollment' using errcode='P3003'; end if;
 select * into existing from public.student_courses where student_id=p_student_id and course_id=publication.course_id;
 if found then
  if existing.initialization_state<>'ready' then raise exception 'Legacy enrollment needs reviewed initialization' using errcode='P3004'; end if;
  if existing.curriculum_version_id<>p_version_id or not exists(select 1 from public.availability_preferences ap where ap.student_course_id=existing.id and ap.preferences=resolved_preferences) then raise exception 'Already enrolled; existing version and preferences remain fixed' using errcode='P3003'; end if;
  return existing.id;
 end if;
 -- Successful new operations are limited; retries do not consume a mutation allowance.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,31));
 if (select count(*) from public.audit_logs where actor_id=actor and action='planning.enrolled' and created_at>now()-interval '1 minute')>=20 then raise exception 'Please wait before enrolling again' using errcode='P0001'; end if;
 academic := public.build_initial_course_plan(publication.document,(resolved_preferences->>'lessonDurationMinutes')::integer);
 calendar := public.build_initial_lesson_schedule(resolved_preferences,(academic->>'lessonCount')::integer,clock_timestamp());
 insert into public.student_courses(student_id,course_id,curriculum_version_id,enrolled_by,creation_request_id,initialization_state) values(p_student_id,publication.course_id,p_version_id,actor,p_request_id,'ready') returning id into enrollment;
 insert into public.student_skills(student_id,skill_id) select p_student_id,(s->>'id')::uuid from jsonb_array_elements(publication.document->'units') u cross join lateral jsonb_array_elements(u->'topics') t cross join lateral jsonb_array_elements(t->'skills') s on conflict(student_id,skill_id) do nothing;
 insert into public.availability_preferences(student_id,student_course_id,preferences) values(p_student_id,enrollment,resolved_preferences);
 insert into public.course_plans(student_course_id,curriculum_version_id,algorithm_version) values(enrollment,p_version_id,'initial-v1') returning id into plan;
 for entry in select value from jsonb_array_elements(calendar) loop
  insert into public.lesson_schedules(student_id,starts_at,ends_at,timezone,course_plan_id,lesson_position) values(p_student_id,(entry->>'startsAt')::timestamptz,(entry->>'endsAt')::timestamptz,entry->>'timezone',plan,(entry->>'position')::integer);
 end loop;
 for entry in select value from jsonb_array_elements(academic->'items') loop
  insert into public.course_plan_items(course_plan_id,skill_id,position,lesson_position,estimated_minutes,objectives,projected_date)
  values(plan,(entry->>'skillId')::uuid,(entry->>'position')::integer,(entry->>'lessonPosition')::integer,(entry->>'estimatedMinutes')::integer,entry->'objectives',(select ((starts_at at time zone (resolved_preferences->>'timezone'))::date) from public.lesson_schedules where course_plan_id=plan and lesson_position=(entry->>'lessonPosition')::integer));
 end loop;
 insert into public.schedule_changes(student_id,previous_state,new_state,reason,trigger,actor_id) values(p_student_id,'{}',jsonb_build_object('enrollment_id',enrollment,'plan_id',plan,'schedule_ids',(select jsonb_agg(id order by lesson_position) from public.lesson_schedules where course_plan_id=plan)),'Initial schedule created from parent-selected availability','initial_enrollment',actor);
 insert into public.audit_logs(actor_id,action,metadata) values(actor,'planning.enrolled',jsonb_build_object('enrollment_id',enrollment,'version_id',p_version_id,'plan_id',plan));
 return enrollment;
end $$;

revoke all on function public.initial_preferences_schema(),public.validate_initial_preferences(jsonb),public.resolve_initial_local_time(timestamp,text),public.build_initial_course_plan(jsonb,integer),public.build_initial_lesson_schedule(jsonb,integer,timestamptz),public.sync_skill_assessment_state(),public.guard_planned_reservation(),public.guard_enrollment_preferences(),public.guard_initial_plan_item(),public.enroll_parent_student(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.enroll_parent_student(uuid,uuid,uuid,jsonb) to authenticated;

create index plan_item_lesson_idx on public.course_plan_items(course_plan_id,lesson_position);
