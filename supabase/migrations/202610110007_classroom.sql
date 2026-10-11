-- Supervised rehearsals reuse canonical lessons and events, never evidence.
alter table public.lessons drop constraint lesson_status;
alter table public.lessons add constraint lesson_status check(status in ('planned','active','completed','cancelled','ready','paused','ended','abandoned'));
alter table public.lessons add column classroom_mode text not null default 'instructional' check(classroom_mode in ('instructional','supervised_preview')),
 add column curriculum_version_id uuid references public.curriculum_versions(id),
 add column event_sequence integer not null default 0 check(event_sequence between 0 and 3000),
 add column interruption_epoch integer not null default 0 check(interruption_epoch>=0),
 add column last_seen_at timestamptz;
create index classroom_publication_idx on public.lessons(curriculum_version_id);
create unique index classroom_reservation_once on public.lessons(schedule_id) where classroom_mode='supervised_preview';
create unique index classroom_one_active_student on public.lessons(student_id) where classroom_mode='supervised_preview' and status in ('ready','active','paused');
alter table private.parent_student_previews add column classroom_lesson_id uuid references public.lessons(id);
create index preview_classroom_idx on private.parent_student_previews(classroom_lesson_id);
alter table public.lesson_events add column sequence integer, add column protocol_version integer,
 add column actor_id uuid references public.users(id), add column source text,
 add column interruption_epoch integer, add column request_fingerprint jsonb;
create unique index classroom_event_sequence on public.lesson_events(lesson_id,sequence) where sequence is not null;
create index classroom_event_actor_idx on public.lesson_events(actor_id);
-- Raw events remain unavailable via REST, including internal fingerprints/actor IDs.
-- The narrow reader projects only validated preview protocol fields.
create function public.require_classroom_preview(p_student uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid := auth.uid(); sess uuid := public.current_auth_session();
begin
 if actor is null or sess is null then raise exception 'Supervised preview required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sess::text,44));
 if public.active_preview_student() is distinct from p_student or not exists(
  select 1 from auth.users a join public.users u on u.id=a.id join auth.sessions s on s.user_id=a.id
  where a.id=actor and a.email_confirmed_at is not null and u.role='PARENT' and s.id=sess
 ) then raise exception 'Supervised preview required' using errcode='42501'; end if;
 perform 1 from public.parent_student_relationships where parent_id=actor and student_id=p_student for share;
 if not found then raise exception 'Student unavailable' using errcode='42501'; end if;
 return actor;
end $$;
create function public.append_classroom_internal(p_lesson uuid,p_id uuid,p_kind text,p_payload jsonb,p_source text,p_fingerprint jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare seq integer; epoch integer;
begin
 update public.lessons set event_sequence=event_sequence+1 where id=p_lesson returning event_sequence,interruption_epoch into seq,epoch;
 insert into public.lesson_events(id,lesson_id,event_type,payload,sequence,protocol_version,actor_id,source,interruption_epoch,request_fingerprint)
 values(p_id,p_lesson,p_kind,p_payload,seq,1,auth.uid(),p_source,epoch,p_fingerprint);
end $$;
create function public.abandon_classroom_internal(p_lesson uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.lessons set status='abandoned',ended_at=clock_timestamp(),interruption_epoch=interruption_epoch+1 where id=p_lesson and status in ('ready','active','paused');
 if found then
  perform public.append_classroom_internal(p_lesson,gen_random_uuid(),'lesson_abandoned','{}','system_preview',null);
  update private.parent_student_previews set classroom_lesson_id=null where classroom_lesson_id=p_lesson;
 end if;
end $$;
create function public.classroom_lifecycle(p_schedule_id uuid,p_request_id uuid,p_action text) returns uuid
language plpgsql security definer set search_path='' as $$
declare reservation public.lesson_schedules; room public.lessons; actor uuid; old public.lesson_events; target text; fp jsonb; occupied uuid;
begin
 if p_schedule_id is null or p_request_id is null or p_action is null or p_action not in ('start','pause','resume','end','heartbeat') then raise exception 'Invalid classroom action' using errcode='22023'; end if;
 select * into reservation from public.lesson_schedules where id=p_schedule_id;
 if not found then raise exception 'Reservation unavailable' using errcode='42501'; end if;
 actor := public.require_classroom_preview(reservation.student_id);
 -- Student lock serializes all competing reservations/sessions, beyond one Auth session.
 perform 1 from public.student_profiles where id=reservation.student_id for update;
 select * into room from public.lessons where schedule_id=p_schedule_id and classroom_mode='supervised_preview' for update;
 fp := jsonb_build_object('action',p_action);
 if room.id is not null then
  select * into old from public.lesson_events where lesson_id=room.id and id=p_request_id;
  if found then
   if old.request_fingerprint is distinct from fp then raise exception 'Conflicting retry' using errcode='22023'; end if;
   return room.id;
  end if;
 end if;
 -- A future scheduled reservation can be rehearsed now; expired/cancelled cannot start.
 if p_action='start' and (reservation.status<>'scheduled' or reservation.ends_at<=clock_timestamp()) then raise exception 'Reservation expired or cancelled' using errcode='22023'; end if;
 if room.id is null then
  if p_action<>'start' then raise exception 'Start the classroom first' using errcode='22023'; end if;
  for occupied in select id from public.lessons where student_id=reservation.student_id and classroom_mode='supervised_preview' and status in ('ready','active','paused') and last_seen_at<clock_timestamp()-interval '15 minutes' loop
   perform public.abandon_classroom_internal(occupied);
  end loop;
  if exists(select 1 from public.lessons where student_id=reservation.student_id and classroom_mode='supervised_preview' and status in ('ready','active','paused')) then raise exception 'Another classroom is open' using errcode='P5001'; end if;
  if not exists(select 1 from public.course_plans p join public.student_courses c on c.id=p.student_course_id join public.curriculum_versions v on v.id=p.curriculum_version_id
   where p.id=reservation.course_plan_id and c.student_id=reservation.student_id and c.initialization_state='ready' and c.status='active' and v.status='published' and c.curriculum_version_id=v.id
   and exists(select 1 from public.course_plan_items i where i.course_plan_id=p.id and i.lesson_position=reservation.lesson_position)) then raise exception 'Pinned plan unavailable' using errcode='22023'; end if;
  insert into public.lessons(student_id,schedule_id,status,classroom_mode,curriculum_version_id,last_seen_at)
   select reservation.student_id,reservation.id,'ready','supervised_preview',p.curriculum_version_id,clock_timestamp() from public.course_plans p where p.id=reservation.course_plan_id returning * into room;
  perform public.append_classroom_internal(room.id,gen_random_uuid(),'lesson_ready','{}','system_preview',null);
  update private.parent_student_previews set classroom_lesson_id=room.id where session_id=public.current_auth_session();
 end if;
 if room.status in ('ready','active','paused') and room.last_seen_at<clock_timestamp()-interval '15 minutes' then
  perform public.abandon_classroom_internal(room.id); return room.id;
 end if;
 if room.status in ('ready','active','paused') and not exists(select 1 from private.parent_student_previews where session_id=public.current_auth_session() and classroom_lesson_id=room.id and ended_at is null) then raise exception 'Classroom belongs to another supervised session' using errcode='42501'; end if;
 if p_action='heartbeat' then
  update public.lessons set last_seen_at=clock_timestamp() where id=room.id and status in ('ready','active','paused'); return room.id;
 end if;
 target := case p_action when 'start' then 'active' when 'pause' then 'paused' when 'resume' then 'active' when 'end' then 'ended' end;
 if not (room.status=target or (p_action='start' and room.status='ready') or (p_action='pause' and room.status='active') or (p_action='resume' and room.status='paused') or (p_action='end' and room.status in ('active','paused','ready'))) then raise exception 'Invalid lesson transition' using errcode='22023'; end if;
 -- State-target retries are no-ops without duplicate timeline entries.
 if room.status=target then return room.id; end if;
 if p_action<>'end' then
  if room.event_sequence>=2990 then raise exception 'Classroom history full; end the rehearsal' using errcode='P5003'; end if;
  if (select count(*) from public.lesson_events where lesson_id=room.id and source='system_preview' and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'Classroom transition limit reached' using errcode='P5002'; end if;
 end if;
 update public.lessons set status=target,started_at=coalesce(started_at,clock_timestamp()),ended_at=case when target='ended' then clock_timestamp() else null end,
  last_seen_at=clock_timestamp(),interruption_epoch=interruption_epoch+case when p_action in ('pause','resume','end') then 1 else 0 end where id=room.id;
 perform public.append_classroom_internal(room.id,p_request_id,'lesson_'||case p_action when 'start' then 'started' when 'pause' then 'paused' when 'resume' then 'resumed' else 'ended' end,'{}','system_preview',fp);
 insert into public.audit_logs(actor_id,action,metadata) values(actor,'classroom.'||p_action,jsonb_build_object('lesson_id',room.id,'mode','supervised_preview'));
 if target='ended' then update private.parent_student_previews set classroom_lesson_id=null where classroom_lesson_id=room.id; end if;
 return room.id;
end $$;

create function public.classroom_command_schema() returns json language sql immutable set search_path='' as $schema$ select $json${"$schema":"https://json-schema.org/draft/2020-12/schema","oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"stroke"},"payload":{"type":"object","properties":{"points":{"minItems":2,"maxItems":256,"type":"array","items":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false}},"color":{"type":"string","enum":["#263b36","#246bce","#c34e35"]},"width":{"type":"number","minimum":1,"maximum":12}},"required":["points","color","width"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"erase"},"payload":{"type":"object","properties":{"targetId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"required":["targetId"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"undo"},"payload":{"type":"object","properties":{"targetId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"required":["targetId"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"redo"},"payload":{"type":"object","properties":{"targetId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"required":["targetId"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"clear_board"},"payload":{"type":"object","properties":{"confirmed":{"type":"boolean","const":true}},"required":["confirmed"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"connection_interrupted"},"payload":{"type":"object","properties":{},"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"connection_recovered"},"payload":{"type":"object","properties":{},"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false}]}$json$::json $schema$;
create function public.classroom_append(p_schedule_id uuid,p_request_id uuid,p_epoch integer,p_command jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare reservation public.lesson_schedules; room public.lessons; old public.lesson_events; fp jsonb; target_event public.lesson_events; last_clear integer; hidden boolean;
begin
 select * into reservation from public.lesson_schedules where id=p_schedule_id;
 if not found then raise exception 'Reservation unavailable' using errcode='42501'; end if;
 perform public.require_classroom_preview(reservation.student_id);
 perform 1 from public.student_profiles where id=reservation.student_id for update;
 select * into room from public.lessons where schedule_id=p_schedule_id and classroom_mode='supervised_preview' for update;
 if room.id is null then raise exception 'Start classroom first' using errcode='22023'; end if;
 if p_request_id is null or p_epoch is null or p_command is null or octet_length(p_command::text)>16384 or not extensions.jsonb_matches_schema(public.classroom_command_schema(),p_command) then raise exception 'Invalid classroom command' using errcode='22023'; end if;
 fp := jsonb_build_object('epoch',p_epoch,'command',p_command);
 select * into old from public.lesson_events where lesson_id=room.id and id=p_request_id;
 if found then
  if old.request_fingerprint is distinct from fp then raise exception 'Conflicting command retry' using errcode='22023'; end if;
  return old.id;
 end if;
 if room.status in ('ready','active','paused') and room.last_seen_at<clock_timestamp()-interval '15 minutes' then
  perform public.abandon_classroom_internal(room.id); return null;
 end if;
 if not exists(select 1 from private.parent_student_previews where session_id=public.current_auth_session() and classroom_lesson_id=room.id and ended_at is null) then raise exception 'Classroom session unavailable' using errcode='42501'; end if;
 if room.status<>'active' or room.interruption_epoch<>p_epoch then raise exception 'Classroom paused, ended or command interrupted' using errcode='40001'; end if;
 if room.event_sequence>=2990 then raise exception 'Classroom history full; end the rehearsal' using errcode='P5003'; end if;
 if (select count(*) from public.lesson_events where lesson_id=room.id and source='student_preview' and created_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'Classroom event limit reached' using errcode='P5002'; end if;
 if p_command->>'kind' in ('erase','undo','redo') then
  select * into target_event from public.lesson_events where lesson_id=room.id and id=(p_command->'payload'->>'targetId')::uuid and event_type='stroke' and source='student_preview';
  select coalesce(max(sequence),0) into last_clear from public.lesson_events where lesson_id=room.id and event_type='clear_board';
  if target_event.id is null or target_event.sequence<last_clear then raise exception 'Drawing target unavailable' using errcode='22023'; end if;
  select event_type<>'redo' into hidden from public.lesson_events where lesson_id=room.id and event_type in ('erase','undo','redo') and payload->>'targetId'=target_event.id::text order by sequence desc limit 1;
  if (p_command->>'kind'='redo') is distinct from coalesce(hidden,false) then raise exception 'Drawing target state invalid' using errcode='22023'; end if;
 end if;
 perform public.append_classroom_internal(room.id,p_request_id,p_command->>'kind',p_command->'payload','student_preview',fp);
 update public.lessons set last_seen_at=clock_timestamp() where id=room.id;
 return p_request_id;
end $$;
create function public.classroom_replay(p_schedule_id uuid,p_after integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare reservation public.lesson_schedules; room public.lessons; events jsonb;
begin
 if p_after is null or p_after<0 or p_after>3000 then raise exception 'Invalid replay cursor' using errcode='22023'; end if;
 select * into reservation from public.lesson_schedules where id=p_schedule_id;
 if not found then raise exception 'Reservation unavailable' using errcode='42501'; end if;
 perform public.require_classroom_preview(reservation.student_id);
 select * into room from public.lessons where schedule_id=p_schedule_id and classroom_mode='supervised_preview' for share;
 select coalesce(jsonb_agg(e order by (e->>'sequence')::integer),'[]'::jsonb) into events from (
  select jsonb_build_object('id',id,'lessonId',lesson_id,'sequence',sequence,'epoch',interruption_epoch,'protocolVersion',protocol_version,'source',source,'kind',event_type,'payload',payload,'createdAt',created_at) e
  from public.lesson_events where lesson_id=room.id and sequence>p_after order by sequence limit 250
 ) projected;
 return jsonb_build_object('lesson',case when room.id is null then null else jsonb_build_object('id',room.id,'status',room.status,'epoch',room.interruption_epoch,'sequence',room.event_sequence,'startedAt',room.started_at,'endedAt',room.ended_at,'lastSeenAt',room.last_seen_at) end,'events',events);
end $$;
-- Leaving preview explicitly abandons any unfinished rehearsal. No reservation,
-- attendance, evidence or mastery record is changed.
create or replace function public.end_student_preview() returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); sess uuid := public.current_auth_session(); selected uuid; room uuid;
begin
 if actor is null or sess is null or not exists (
  select 1 from auth.users a join public.users u on u.id=a.id join public.parent_profiles p on p.user_id=u.id join auth.sessions s on s.user_id=a.id
  where a.id=actor and a.email_confirmed_at is not null and u.role='PARENT' and s.id=sess
 ) then raise exception 'Active parent session required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sess::text,44));
 select student_id,classroom_lesson_id into selected,room from private.parent_student_previews where session_id=sess and parent_id=actor and ended_at is null;
 if selected is not null then
  perform 1 from public.student_profiles where id=selected for update;
  if room is not null then perform public.abandon_classroom_internal(room); end if;
  update private.parent_student_previews set ended_at=clock_timestamp(),classroom_lesson_id=null where session_id=sess;
  insert into public.audit_logs(actor_id,action,metadata) values(actor,'preview.ended',jsonb_build_object('student_id',selected));
 end if;
 return selected;
end $$;
revoke all on function public.require_classroom_preview(uuid), public.append_classroom_internal(uuid,uuid,text,jsonb,text,jsonb), public.abandon_classroom_internal(uuid),public.classroom_command_schema(),public.classroom_lifecycle(uuid,uuid,text),public.classroom_append(uuid,uuid,integer,jsonb),public.classroom_replay(uuid,integer) from public,anon,authenticated;
grant execute on function public.classroom_lifecycle(uuid,uuid,text), public.classroom_append(uuid,uuid,integer,jsonb), public.classroom_replay(uuid,integer) to authenticated;

-- Preserve the rehearsal classification/pin even for ordinary trusted writes.
alter table public.lessons add constraint classroom_mode_state check (
 (classroom_mode='instructional' and status in ('planned','active','completed','cancelled')) or
 (classroom_mode='supervised_preview' and status in ('ready','active','paused','ended','abandoned') and schedule_id is not null and curriculum_version_id is not null)
);
create function public.guard_classroom_lesson() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.classroom_mode='supervised_preview' or new.classroom_mode='supervised_preview') and
  row(new.classroom_mode,new.student_id,new.schedule_id,new.curriculum_version_id) is distinct from row(old.classroom_mode,old.student_id,old.schedule_id,old.curriculum_version_id) then
  raise exception 'Rehearsal identity and publication are immutable' using errcode='22023';
 end if;
 if new.classroom_mode='supervised_preview' and not exists(
  select 1 from public.lesson_schedules s join public.course_plans p on p.id=s.course_plan_id join public.student_courses c on c.id=p.student_course_id join public.curriculum_versions v on v.id=p.curriculum_version_id
  where s.id=new.schedule_id and s.student_id=new.student_id and c.student_id=new.student_id and v.id=new.curriculum_version_id and v.status='published' and c.curriculum_version_id=v.id
 ) then raise exception 'Rehearsal must retain its scheduled published plan' using errcode='23503'; end if;
 return new;
end $$;
create trigger guard_classroom_lesson before insert or update on public.lessons for each row execute function public.guard_classroom_lesson();
create function public.guard_classroom_event() returns trigger language plpgsql security definer set search_path='' as $$
declare room public.lessons;
begin
 if tg_op in ('UPDATE','DELETE') then
  if old.sequence is not null then raise exception 'Classroom timeline is append-only' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; end if;
 end if;
 select * into room from public.lessons where id=new.lesson_id;
 if room.classroom_mode='supervised_preview' then
  if new.sequence is null or new.sequence<>room.event_sequence or new.interruption_epoch is distinct from room.interruption_epoch or new.protocol_version is distinct from 1 or new.actor_id is null
   then raise exception 'Invalid classroom event envelope' using errcode='22023'; end if;
  if new.source='student_preview' then
   if octet_length(new.payload::text)>16384 or not extensions.jsonb_matches_schema(public.classroom_command_schema(),jsonb_build_object('kind',new.event_type,'payload',new.payload)) then raise exception 'Invalid student event' using errcode='22023'; end if;
  elsif new.source='system_preview' then
   if new.event_type not in ('lesson_ready','lesson_started','lesson_paused','lesson_resumed','lesson_ended','lesson_abandoned') or new.payload<>'{}'::jsonb then raise exception 'Invalid lifecycle event' using errcode='22023'; end if;
  else raise exception 'Invalid classroom source' using errcode='22023'; end if;
 elsif new.sequence is not null then raise exception 'Preview protocol cannot write instructional events' using errcode='22023'; end if;
 return new;
end $$;
create trigger guard_classroom_event before insert or update or delete on public.lesson_events for each row execute function public.guard_classroom_event();
revoke all on function public.guard_classroom_lesson(),public.guard_classroom_event() from public,anon,authenticated;
