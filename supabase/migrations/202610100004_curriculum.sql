-- Versioned academic documents, validated equally in the database and application.
create extension if not exists pg_jsonschema with schema extensions;
create function public.curriculum_document_schema() returns json language sql immutable set search_path = '' as $schema$ select $json${"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"schemaVersion":{"type":"number","const":1},"curriculumId":{"type":"string","pattern":"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"description":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"academicLevel":{"type":"integer","minimum":1,"maximum":12},"subject":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"learningObjectives":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"units":{"maxItems":100,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","pattern":"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"description":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"position":{"type":"integer","exclusiveMinimum":0,"maximum":9007199254740991},"learningObjectives":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"topics":{"maxItems":500,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","pattern":"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"description":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"position":{"type":"integer","exclusiveMinimum":0,"maximum":9007199254740991},"teachingObjectives":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"expectedOutcomes":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"content":{"type":"object","properties":{"learningObjectives":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"keyConcepts":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"explanations":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"workedExamples":{"maxItems":100,"type":"array","items":{"type":"object","properties":{"problem":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"steps":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}}},"required":["problem","steps"],"additionalProperties":false}},"commonMistakes":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"practiceQuestions":{"maxItems":100,"type":"array","items":{"type":"object","properties":{"skillId":{"type":"string","pattern":"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"},"prompt":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"required":["skillId","prompt"],"additionalProperties":false}},"assessmentObjectives":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"whiteboardPlans":{"maxItems":100,"type":"array","items":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"steps":{"maxItems":100,"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}}},"required":["title","steps"],"additionalProperties":false}},"resourceReferences":{"maxItems":100,"type":"array","items":{"type":"object","properties":{"label":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"reference":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"required":["label","reference"],"additionalProperties":false}}},"required":["learningObjectives","keyConcepts","explanations","workedExamples","commonMistakes","practiceQuestions","assessmentObjectives","whiteboardPlans","resourceReferences"],"additionalProperties":false},"skills":{"maxItems":1000,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","pattern":"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"},"code":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"description":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"position":{"type":"integer","exclusiveMinimum":0,"maximum":9007199254740991},"difficulty":{"type":"integer","minimum":1,"maximum":5},"estimatedMinutes":{"type":"integer","minimum":1,"maximum":600},"masteryThreshold":{"type":"number","exclusiveMinimum":0,"maximum":1},"assessment":{"type":"object","properties":{"independentCorrectRequired":{"type":"integer","minimum":1,"maximum":20},"allowHintsForMastery":{"type":"boolean"}},"required":["independentCorrectRequired","allowHintsForMastery"],"additionalProperties":false}},"required":["id","code","name","description","position","difficulty","estimatedMinutes","masteryThreshold","assessment"],"additionalProperties":false}}},"required":["id","name","description","position","teachingObjectives","expectedOutcomes","content","skills"],"additionalProperties":false}}},"required":["id","name","description","position","learningObjectives","topics"],"additionalProperties":false}},"prerequisites":{"maxItems":10000,"type":"array","items":{"type":"object","properties":{"skillId":{"type":"string","pattern":"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"},"prerequisiteId":{"type":"string","pattern":"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"}},"required":["skillId","prerequisiteId"],"additionalProperties":false}}},"required":["schemaVersion","curriculumId","name","description","academicLevel","subject","learningObjectives","units","prerequisites"],"additionalProperties":false}$json$::json $schema$;

create table public.curriculum_versions (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.courses(id),
 version integer not null check(version > 0),
 revision integer not null default 1 check(revision > 0),
 status text not null default 'draft' check(status in ('draft','published')),
 document jsonb not null,
 created_by uuid references public.users(id),
 published_by uuid references public.users(id),
 created_at timestamptz not null default now(),
 published_at timestamptz,
 unique(course_id,version), unique(id,course_id),
 check ((status='published') = (published_at is not null)),
 check (extensions.jsonb_matches_schema(public.curriculum_document_schema(),document))
);
alter table public.curriculum_versions enable row level security;
grant select on public.curriculum_versions to authenticated;
grant all on public.curriculum_versions to service_role;
create function public.is_academic_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users u join auth.users a on a.id=u.id where u.id=auth.uid() and u.role='ADMIN' and a.email_confirmed_at is not null)
$$;
grant execute on function public.is_academic_admin() to authenticated;
create policy "published academic read" on public.curriculum_versions for select to authenticated using (
 public.is_academic_admin() or (status='published' and exists(select 1 from public.users where id=auth.uid() and role='PARENT'))
);

create function public.validate_curriculum_document(d jsonb, publishing boolean default false) returns void
language plpgsql set search_path='' as $$
declare u jsonb; t jsonb; s jsonb; e jsonb; c jsonb; ids uuid[] := array[]::uuid[]; all_ids uuid[] := array[]::uuid[]; positions integer[]; topic_ids uuid[];
 remaining uuid[]; ready uuid[]; node uuid;
begin
 if d is null or octet_length(d::text)>2000000 or not extensions.jsonb_matches_schema(public.curriculum_document_schema(),d) then raise exception 'Invalid academic document' using errcode='22023'; end if;
 if publishing and (jsonb_array_length(d->'units')=0 or jsonb_array_length(d->'learningObjectives')=0) then raise exception 'Course is not publication ready' using errcode='22023'; end if;
 positions := '{}';
 for u in select value from jsonb_array_elements(d->'units') loop
  node := (u->>'id')::uuid;
  if node=any(all_ids) or (u->>'position')::integer=any(positions) then raise exception 'Duplicate identity or position' using errcode='22023'; end if;
  all_ids := array_append(all_ids,node); positions := array_append(positions,(u->>'position')::integer);
 end loop;
 for u in select value from jsonb_array_elements(d->'units') loop
  if publishing and (jsonb_array_length(u->'topics')=0 or jsonb_array_length(u->'learningObjectives')=0) then raise exception 'Unit is not publication ready' using errcode='22023'; end if;
  positions := '{}';
  for t in select value from jsonb_array_elements(u->'topics') loop
   node := (t->>'id')::uuid;
   if node=any(all_ids) or (t->>'position')::integer=any(positions) then raise exception 'Duplicate identity or position' using errcode='22023'; end if;
   all_ids := array_append(all_ids,node); positions := array_append(positions,(t->>'position')::integer);
  end loop;
  for t in select value from jsonb_array_elements(u->'topics') loop
   positions := '{}'; topic_ids := '{}'; c := t->'content';
   for s in select value from jsonb_array_elements(t->'skills') loop
    node := (s->>'id')::uuid;
    if node=any(all_ids) or (s->>'position')::integer=any(positions) then raise exception 'Duplicate identity or position' using errcode='22023'; end if;
    all_ids := array_append(all_ids,node); positions := array_append(positions,(s->>'position')::integer);
    ids := array_append(ids,node); topic_ids := array_append(topic_ids,node);
   end loop;
   if exists(select 1 from jsonb_array_elements(c->'practiceQuestions') q where not (q->>'skillId')::uuid=any(topic_ids)) then raise exception 'Practice question outside topic' using errcode='22023'; end if;
   if publishing and (
    jsonb_array_length(t->'skills')=0 or jsonb_array_length(t->'teachingObjectives')=0 or jsonb_array_length(t->'expectedOutcomes')=0 or
    jsonb_array_length(c->'learningObjectives')=0 or jsonb_array_length(c->'keyConcepts')=0 or jsonb_array_length(c->'explanations')=0 or
    jsonb_array_length(c->'workedExamples')=0 or jsonb_array_length(c->'commonMistakes')=0 or jsonb_array_length(c->'practiceQuestions')=0 or
    jsonb_array_length(c->'assessmentObjectives')=0 or jsonb_array_length(c->'whiteboardPlans')=0 or
    exists(select 1 from jsonb_array_elements(c->'workedExamples') x where jsonb_array_length(x->'steps')=0) or
    exists(select 1 from jsonb_array_elements(c->'whiteboardPlans') x where jsonb_array_length(x->'steps')=0)
   ) then raise exception 'Topic is not publication ready' using errcode='22023'; end if;
  end loop;
 end loop;
 for e in select value from jsonb_array_elements(d->'prerequisites') loop
  if e->>'skillId'=e->>'prerequisiteId' or not (e->>'skillId')::uuid=any(ids) or not (e->>'prerequisiteId')::uuid=any(ids) then raise exception 'Invalid prerequisite scope or self dependency' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'prerequisites') edge group by edge having count(*)>1) then raise exception 'Duplicate prerequisite' using errcode='22023'; end if;
 if cardinality(ids)>1000 then raise exception 'Too many course skills' using errcode='22023'; end if;
 remaining := ids;
 while cardinality(remaining)>0 loop
  select array_agg(n) into ready from unnest(remaining) n where not exists(
   select 1 from jsonb_array_elements(d->'prerequisites') edge where (edge->>'skillId')::uuid=n and (edge->>'prerequisiteId')::uuid=any(remaining));
  if ready is null then raise exception 'Prerequisite cycle' using errcode='22023'; end if;
  foreach node in array ready loop remaining := array_remove(remaining,node); end loop;
 end loop;
end $$;

-- Register stable identities once; snapshot titles, ordering and associations are version-specific.
-- The canonical identity hierarchy owns each ID's course, not its future display position.
create function public.guard_curriculum_version() returns trigger language plpgsql security definer set search_path='' as $$
declare u jsonb; t jsonb; s jsonb;
begin
 if tg_op='DELETE' then raise exception 'Curriculum versions cannot be deleted' using errcode='42501'; end if;
 if tg_op='UPDATE' and (old.status='published' or new.id<>old.id or new.course_id<>old.course_id or new.version<>old.version or new.created_by is distinct from old.created_by or new.created_at<>old.created_at) then raise exception 'Immutable curriculum identity or publication' using errcode='42501'; end if;
 perform 1 from public.courses where id=new.course_id for update;
 perform public.validate_curriculum_document(new.document,new.status='published');
 if not exists(select 1 from public.courses where id=new.course_id and curriculum_id=(new.document->>'curriculumId')::uuid) then raise exception 'Invalid curriculum association' using errcode='22023'; end if;
 for u in select value from jsonb_array_elements(new.document->'units') loop
  insert into public.units(id,course_id,title,position) select (u->>'id')::uuid,new.course_id,u->>'name',coalesce(max(position),0)+1 from public.units where course_id=new.course_id on conflict(id) do nothing;
  if not exists(select 1 from public.units where id=(u->>'id')::uuid and course_id=new.course_id) then raise exception 'Unit outside course' using errcode='22023'; end if;
  for t in select value from jsonb_array_elements(u->'topics') loop
   -- Moving a topic between units in the same course is permitted in snapshots.
   insert into public.topics(id,unit_id,title,position) select (t->>'id')::uuid,(u->>'id')::uuid,t->>'name',coalesce(max(position),0)+1 from public.topics where unit_id=(u->>'id')::uuid on conflict(id) do nothing;
   if not exists(select 1 from public.topics x join public.units y on y.id=x.unit_id where x.id=(t->>'id')::uuid and y.course_id=new.course_id) then raise exception 'Topic outside course' using errcode='22023'; end if;
   for s in select value from jsonb_array_elements(t->'skills') loop
    insert into public.skills(id,topic_id,code,title) values((s->>'id')::uuid,(t->>'id')::uuid,s->>'code',s->>'name') on conflict(id) do nothing;
    if not exists(select 1 from public.skills x join public.topics y on y.id=x.topic_id join public.units z on z.id=y.unit_id where x.id=(s->>'id')::uuid and x.code=s->>'code' and z.course_id=new.course_id) then raise exception 'Skill outside course or changed code' using errcode='22023'; end if;
   end loop;
  end loop;
 end loop;
 return new;
end $$;
create trigger guard_curriculum_version before insert or update or delete on public.curriculum_versions for each row execute function public.guard_curriculum_version();

create function public.save_curriculum_draft(p_course_id uuid,p_version_id uuid default null,p_expected_revision integer default 0,p_document jsonb default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.curriculum_versions; next_version integer; actor uuid := auth.uid();
begin
 if not public.is_academic_admin() then raise exception 'Verified academic administrator required' using errcode='42501'; end if;
 if p_course_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid draft arguments' using errcode='22023'; end if;
 perform public.validate_curriculum_document(p_document,false);
 -- Serializes version numbering and course creation, including concurrent first drafts.
 perform pg_advisory_xact_lock(hashtextextended(p_course_id::text,27));
 insert into public.courses(id,curriculum_id,title) values(p_course_id,(p_document->>'curriculumId')::uuid,p_document->>'name') on conflict(id) do nothing;
 perform 1 from public.courses where id=p_course_id for update;
 if p_version_id is null then
  if p_expected_revision<>0 then raise exception 'New draft requires revision zero' using errcode='40001'; end if;
  select coalesce(max(version),0)+1 into next_version from public.curriculum_versions where course_id=p_course_id;
  insert into public.curriculum_versions(course_id,version,document,created_by) values(p_course_id,next_version,p_document,actor) returning * into v;
 else
  select * into v from public.curriculum_versions where id=p_version_id and course_id=p_course_id for update;
  if not found then raise exception 'Unknown course version' using errcode='22023'; end if;
  if v.status<>'draft' then raise exception 'Published version is immutable' using errcode='42501'; end if;
  if v.revision<>p_expected_revision then raise exception 'Draft revision conflict' using errcode='40001'; end if;
  update public.curriculum_versions set document=p_document,revision=revision+1 where id=v.id returning * into v;
 end if;
 insert into public.audit_logs(actor_id,action,metadata) values(actor,'curriculum.draft_saved',jsonb_build_object('version_id',v.id,'revision',v.revision));
 return v.id;
end $$;
create function public.publish_curriculum_version(p_version_id uuid,p_expected_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.curriculum_versions; course uuid;
begin
 if not public.is_academic_admin() then raise exception 'Verified academic administrator required' using errcode='42501'; end if;
 if p_version_id is null or p_expected_revision is null or p_expected_revision<1 then raise exception 'Invalid publication arguments' using errcode='22023'; end if;
 select course_id into course from public.curriculum_versions where id=p_version_id;
 if course is null then raise exception 'Unknown course version' using errcode='22023'; end if;
 perform 1 from public.courses where id=course for update;
 select * into v from public.curriculum_versions where id=p_version_id for update;
 if v.status='published' then
  if v.revision=p_expected_revision then return v.id; end if;
  raise exception 'Publication revision conflict' using errcode='40001';
 end if;
 if v.revision<>p_expected_revision then raise exception 'Draft revision conflict' using errcode='40001'; end if;
 perform public.validate_curriculum_document(v.document,true);
 update public.curriculum_versions set status='published',published_at=now(),published_by=auth.uid() where id=v.id;
 return v.id;
end $$;
grant execute on function public.save_curriculum_draft(uuid,uuid,integer,jsonb),public.publish_curriculum_version(uuid,integer) to authenticated;

-- Legacy catalog APIs may expose only identities occurring in a published snapshot.
create function public.published_academic_identity(p_id uuid,p_kind text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.curriculum_versions v where v.status='published' and (
  (p_kind='curricula' and (v.document->>'curriculumId')::uuid=p_id) or (p_kind='courses' and v.course_id=p_id) or
  (p_kind='units' and exists(select 1 from jsonb_array_elements(v.document->'units') u where (u->>'id')::uuid=p_id)) or
  (p_kind='topics' and exists(select 1 from jsonb_array_elements(v.document->'units') u cross join lateral jsonb_array_elements(u->'topics') t where (t->>'id')::uuid=p_id)) or
  (p_kind='skills' and exists(select 1 from jsonb_array_elements(v.document->'units') u cross join lateral jsonb_array_elements(u->'topics') t cross join lateral jsonb_array_elements(t->'skills') s where (s->>'id')::uuid=p_id))
 ))
$$;
grant execute on function public.published_academic_identity(uuid,text) to authenticated;
drop policy "read curricula" on public.curricula;
drop policy "read courses" on public.courses;
drop policy "read units" on public.units;
drop policy "read topics" on public.topics;
drop policy "read skills" on public.skills;
create policy "read curricula" on public.curricula for select to authenticated using (public.published_academic_identity(id,'curricula'));
create policy "read courses" on public.courses for select to authenticated using (public.published_academic_identity(id,'courses'));
create policy "read units" on public.units for select to authenticated using (public.published_academic_identity(id,'units'));
create policy "read topics" on public.topics for select to authenticated using (public.published_academic_identity(id,'topics'));
create policy "read skills" on public.skills for select to authenticated using (public.published_academic_identity(id,'skills'));
-- Legacy edges/maps are retained compatibility data; version services never consume them.

alter table public.student_courses add column curriculum_version_id uuid;
update public.student_courses sc set curriculum_version_id=(select id from public.curriculum_versions v where v.course_id=sc.course_id and v.status='published' order by version limit 1);
-- Existing installations with enrollments must publish a reviewed legacy snapshot before enforcing NOT NULL.
-- New inserts always resolve a publication, preserving old test/fixture callers without adding an enrollment UI.
do $$ begin
 if exists(select 1 from public.student_courses where curriculum_version_id is null) then
  raise exception 'Unversioned legacy enrollments require reviewed snapshot backfill before this migration';
 end if;
end $$;
alter table public.student_courses alter column curriculum_version_id set not null;
alter table public.student_courses add constraint student_course_version_fk foreign key(curriculum_version_id,course_id) references public.curriculum_versions(id,course_id);
create index student_course_version_idx on public.student_courses(curriculum_version_id,course_id);
create function public.pin_student_curriculum() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.course_id<>old.course_id or new.curriculum_version_id is distinct from old.curriculum_version_id) then raise exception 'Controlled curriculum migration is not enabled' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.curriculum_version_id is null then select id into new.curriculum_version_id from public.curriculum_versions where course_id=new.course_id and status='published' order by version limit 1; end if;
  if not exists(select 1 from public.curriculum_versions where id=new.curriculum_version_id and course_id=new.course_id and status='published') then raise exception 'Enrollment requires a published course version' using errcode='22023'; end if;
 end if;
 return new;
end $$;
create trigger pin_student_curriculum before insert or update on public.student_courses for each row execute function public.pin_student_curriculum();

-- Audit publication regardless of whether it came from an RPC or trusted seed/maintenance.
create function public.audit_curriculum_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and (tg_op='INSERT' or old.status<>'published') then
  insert into public.audit_logs(actor_id,action,metadata) values(auth.uid(),'curriculum.published',jsonb_build_object('version_id',new.id,'version',new.version));
 end if;
 return new;
end $$;
create trigger audit_curriculum_publication after insert or update on public.curriculum_versions for each row execute function public.audit_curriculum_publication();
create index curriculum_created_by_idx on public.curriculum_versions(created_by);
create index curriculum_published_by_idx on public.curriculum_versions(published_by);

-- Historical course plans resolve a fixed snapshot even after controlled enrollment migration exists.
alter table public.course_plans add column curriculum_version_id uuid references public.curriculum_versions(id);
update public.course_plans cp set curriculum_version_id=sc.curriculum_version_id from public.student_courses sc where sc.id=cp.student_course_id;
alter table public.course_plans alter column curriculum_version_id set not null;
create index course_plan_curriculum_idx on public.course_plans(curriculum_version_id);
create function public.pin_course_plan_curriculum() returns trigger language plpgsql security definer set search_path='' as $$
declare pinned uuid;
begin
 if tg_op='UPDATE' and (new.student_course_id<>old.student_course_id or new.curriculum_version_id<>old.curriculum_version_id) then raise exception 'Course plan curriculum is immutable' using errcode='42501'; end if;
 if tg_op='INSERT' then
  select curriculum_version_id into pinned from public.student_courses where id=new.student_course_id for share;
  if new.curriculum_version_id is null then new.curriculum_version_id := pinned; end if;
  if pinned is null or new.curriculum_version_id<>pinned then raise exception 'Course plan must use enrollment snapshot' using errcode='22023'; end if;
 end if;
 return new;
end $$;
create trigger pin_course_plan_curriculum before insert or update on public.course_plans for each row execute function public.pin_course_plan_curriculum();

-- Identity rows cannot be removed or reassigned after a version references them.
create function public.guard_academic_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare old_row jsonb := to_jsonb(old); new_row jsonb;
begin
 if tg_op='UPDATE' then
  new_row := to_jsonb(new);
  if new_row->'id'=old_row->'id' and new_row->'curriculum_id' is not distinct from old_row->'curriculum_id'
   and new_row->'course_id' is not distinct from old_row->'course_id' and new_row->'unit_id' is not distinct from old_row->'unit_id'
   and new_row->'topic_id' is not distinct from old_row->'topic_id' and new_row->'code' is not distinct from old_row->'code' then return new; end if;
 end if;
 if exists(select 1 from public.curriculum_versions v where v.course_id=old.id or (v.document->>'curriculumId')::uuid=old.id or
  jsonb_path_exists(v.document,'$.units[*].id ? (@ == $id)',jsonb_build_object('id',old.id::text)) or
  jsonb_path_exists(v.document,'$.units[*].topics[*].id ? (@ == $id)',jsonb_build_object('id',old.id::text)) or
  jsonb_path_exists(v.document,'$.units[*].topics[*].skills[*].id ? (@ == $id)',jsonb_build_object('id',old.id::text))) then
  raise exception 'Referenced academic identity is immutable' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger guard_academic_identity before update or delete on public.curricula for each row execute function public.guard_academic_identity();
create trigger guard_academic_identity before update or delete on public.courses for each row execute function public.guard_academic_identity();
create trigger guard_academic_identity before update or delete on public.units for each row execute function public.guard_academic_identity();
create trigger guard_academic_identity before update or delete on public.topics for each row execute function public.guard_academic_identity();
create trigger guard_academic_identity before update or delete on public.skills for each row execute function public.guard_academic_identity();

-- Explicit revocation is required even where local/hosted defaults differ.
revoke all on function public.curriculum_document_schema(),public.is_academic_admin(),public.validate_curriculum_document(jsonb,boolean),public.guard_curriculum_version(),public.save_curriculum_draft(uuid,uuid,integer,jsonb),public.publish_curriculum_version(uuid,integer),public.published_academic_identity(uuid,text),public.pin_student_curriculum(),public.audit_curriculum_publication(),public.pin_course_plan_curriculum(),public.guard_academic_identity() from public,anon,authenticated;
grant execute on function public.is_academic_admin(),public.published_academic_identity(uuid,text),public.save_curriculum_draft(uuid,uuid,integer,jsonb),public.publish_curriculum_version(uuid,integer) to authenticated;
grant execute on function public.curriculum_document_schema() to service_role;
