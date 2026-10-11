create function public.maya_mock_templates_internal() returns jsonb language sql immutable set search_path='' as $$select $mock_templates${"integers":[{"narration":"Today we will add signed integers. Start at negative three on a number line, then add seven. Adding a positive number moves us to the right.","durationMs":4000,"offsetMs":1200,"board":{"kind":"write_math","at":{"x":0.12,"y":0.18},"text":"\u22123 + 7"},"question":null,"fallback":"Imagine you owe three counters and receive seven. Three cancel the debt, leaving four counters."},{"narration":"Move seven places right from negative three. Three moves reach zero, and four more reach positive four. The sum is four.","durationMs":4000,"offsetMs":1200,"board":{"kind":"write_math","at":{"x":0.12,"y":0.4},"text":"\u22123 + 7 = 4"},"question":null,"fallback":"Separate seven into three plus four. Negative three plus three is zero; zero plus four is four."},{"narration":"Notice that we crossed zero and finished on the positive side. Take a moment to explain why the answer is positive.","durationMs":3500,"offsetMs":1000,"board":{"kind":"highlight","box":{"x":0.1,"y":0.3,"width":0.55,"height":0.15}},"question":"Why is the result positive? Explain using the number line.","fallback":"Which is larger: the three places left of zero, or the seven places we move right?"}],"inverse":[{"narration":"Our objective is to identify an inverse operation while preserving equality. Consider x plus five equals nine. We want to undo adding five.","durationMs":4000,"offsetMs":1200,"board":{"kind":"write_math","at":{"x":0.12,"y":0.18},"text":"x + 5 = 9"},"question":null,"fallback":"Think of two balanced sides. Whatever we remove from one side, we must remove from the other."},{"narration":"Let's subtract five from both sides. Subtraction undoes addition. On the right, nine minus five is four, so x equals four.","durationMs":4000,"offsetMs":1200,"board":{"kind":"write_math","at":{"x":0.12,"y":0.4},"text":"x + 5 \u2212 5 = 9 \u2212 5;  x = 4"},"question":null,"fallback":"Five added to an unknown makes nine. The unknown is the difference between nine and five."},{"narration":"Check: four plus five equals nine. What should we do to undo multiplying by two? Take time to explain your reasoning.","durationMs":3500,"offsetMs":1000,"board":{"kind":"highlight","box":{"x":0.1,"y":0.3,"width":0.78,"height":0.15}},"question":"What operation undoes multiplication by two, and why?","fallback":"Ask which operation shares a quantity into two equal groups."}]}$mock_templates$::jsonb$$;
revoke all on function public.maya_mock_templates_internal() from public,anon,authenticated;
create function public.maya_mock_event_schema_internal() returns json language sql immutable set search_path='' as $$select $mock_events${"$schema":"https://json-schema.org/draft/2020-12/schema","oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"maya_tool_call"},"payload":{"type":"object","properties":{"callId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"name":{"type":"string","enum":["get_lesson_context","get_current_objective","get_relevant_skills","get_current_board_state","show_whiteboard_content","write_whiteboard_math","highlight_whiteboard_region","ask_student_question","request_student_explanation","unapproved"]},"outcome":{"type":"string","enum":["proposed","validated","rejected"]}},"required":["callId","name","outcome"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_session_started"},"payload":{"type":"object","properties":{"provider":{"type":"string","const":"mock"},"policyVersion":{"type":"string","const":"maya-mock-1"},"plannerVersion":{"type":"string","const":"mock-planner-1"}},"required":["provider","policyVersion","plannerVersion"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_explanation_started"},"payload":{"type":"object","properties":{"step":{"type":"integer","minimum":0,"maximum":9},"speechId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"narration":{"type":"string","minLength":1,"maxLength":1000},"durationMs":{"type":"integer","minimum":2500,"maximum":10000},"offsetMs":{"type":"integer","minimum":500,"maximum":2000},"generation":{"type":"integer","minimum":0,"maximum":9007199254740991},"boardAlreadyApplied":{"type":"boolean"}},"required":["step","speechId","narration","durationMs","offsetMs","generation","boardAlreadyApplied"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_whiteboard_issued"},"payload":{"type":"object","properties":{"step":{"type":"integer","minimum":0,"maximum":9},"speechId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"action":{"oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"write_text"},"at":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false},"text":{"type":"string","minLength":1,"maxLength":500}},"required":["kind","at","text"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"write_math"},"at":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false},"text":{"type":"string","minLength":1,"maxLength":500}},"required":["kind","at","text"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"draw_line"},"from":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false},"to":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false}},"required":["kind","from","to"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"draw_shape"},"shape":{"type":"string","enum":["rectangle","ellipse"]},"box":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1},"width":{"type":"number","minimum":0,"maximum":1},"height":{"type":"number","minimum":0,"maximum":1}},"required":["x","y","width","height"],"additionalProperties":false}},"required":["kind","shape","box"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"draw_graph"},"points":{"minItems":2,"maxItems":256,"type":"array","items":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false}}},"required":["kind","points"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"highlight"},"box":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1},"width":{"type":"number","minimum":0,"maximum":1},"height":{"type":"number","minimum":0,"maximum":1}},"required":["x","y","width","height"],"additionalProperties":false}},"required":["kind","box"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"point_to"},"at":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false}},"required":["kind","at"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"erase"},"targetId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"required":["kind","targetId"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"clear_board"}},"required":["kind"],"additionalProperties":false}]}},"required":["step","speechId","action"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_whiteboard_applied"},"payload":{"type":"object","properties":{"step":{"type":"integer","minimum":0,"maximum":9},"speechId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"command":{"type":"object","properties":{"protocolVersion":{"type":"number","const":1},"commandId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"lessonId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"sequence":{"type":"integer","exclusiveMinimum":0,"maximum":9007199254740991},"actor":{"type":"string","const":"maya"},"epoch":{"type":"integer","minimum":0,"maximum":9007199254740991},"synchronization":{"type":"object","properties":{"speechId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"anchor":{"type":"string","enum":["speech_start","playback_offset","speech_end"]},"offsetMs":{"type":"integer","minimum":0,"maximum":300000}},"required":["speechId","anchor","offsetMs"],"additionalProperties":false},"action":{"oneOf":[{"type":"object","properties":{"kind":{"type":"string","const":"write_text"},"at":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false},"text":{"type":"string","minLength":1,"maxLength":500}},"required":["kind","at","text"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"write_math"},"at":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false},"text":{"type":"string","minLength":1,"maxLength":500}},"required":["kind","at","text"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"draw_line"},"from":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false},"to":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false}},"required":["kind","from","to"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"draw_shape"},"shape":{"type":"string","enum":["rectangle","ellipse"]},"box":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1},"width":{"type":"number","minimum":0,"maximum":1},"height":{"type":"number","minimum":0,"maximum":1}},"required":["x","y","width","height"],"additionalProperties":false}},"required":["kind","shape","box"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"draw_graph"},"points":{"minItems":2,"maxItems":256,"type":"array","items":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false}}},"required":["kind","points"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"highlight"},"box":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1},"width":{"type":"number","minimum":0,"maximum":1},"height":{"type":"number","minimum":0,"maximum":1}},"required":["x","y","width","height"],"additionalProperties":false}},"required":["kind","box"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"point_to"},"at":{"type":"object","properties":{"x":{"type":"number","minimum":0,"maximum":1},"y":{"type":"number","minimum":0,"maximum":1}},"required":["x","y"],"additionalProperties":false}},"required":["kind","at"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"erase"},"targetId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"required":["kind","targetId"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"clear_board"}},"required":["kind"],"additionalProperties":false}]}},"required":["protocolVersion","commandId","lessonId","sequence","actor","epoch","action"],"additionalProperties":false}},"required":["step","speechId","command"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_explanation_completed"},"payload":{"type":"object","properties":{"step":{"type":"integer","minimum":0,"maximum":9},"speechId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"question":{"anyOf":[{"type":"string","minLength":1,"maxLength":1000},{"type":"null"}]}},"required":["step","speechId","question"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_tool_validated"},"payload":{"type":"object","properties":{"name":{"type":"string","const":"show_whiteboard_content"},"callId":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"required":["name","callId"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_interrupted"},"payload":{"type":"object","properties":{"speechId":{"anyOf":[{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},{"type":"null"}]}},"required":["speechId"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_hint"},"payload":{"type":"object","properties":{"step":{"type":"integer","minimum":0,"maximum":9},"text":{"type":"string","minLength":1,"maxLength":1000}},"required":["step","text"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_response_simulated"},"payload":{"type":"object","properties":{"step":{"type":"integer","minimum":0,"maximum":9},"text":{"type":"string","minLength":1,"maxLength":1000}},"required":["step","text"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false},{"type":"object","properties":{"kind":{"type":"string","const":"maya_session_stopped"},"payload":{"type":"object","properties":{"reason":{"type":"string","enum":["explicit","duration","lesson_closed"]}},"required":["reason"],"additionalProperties":false}},"required":["kind","payload"],"additionalProperties":false}]}$mock_events$::json$$;
revoke all on function public.maya_mock_event_schema_internal() from public,anon,authenticated;
-- Simulation-only teaching shares canonical lessons, plans and ordered events.
-- No external provider, media, attendance, evidence or learning-state write.
alter table public.lessons add column maya_started_at timestamptz,
 add column maya_stopped_at timestamptz,
 add column maya_step integer not null default -1 check(maya_step between -1 and 9),
 add column maya_pending uuid,
 add column maya_pending_at timestamptz,
 add column maya_applied boolean not null default false;

create function public.maya_mock_plan_internal(p_lesson_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare room public.lessons; document jsonb; selected public.course_plan_items; definition jsonb; steps jsonb; prerequisites jsonb;
begin
 select * into room from public.lessons where id=p_lesson_id and classroom_mode='supervised_preview';
 if not found then raise exception 'Rehearsal required' using errcode='42501'; end if;
 select v.document into document from public.curriculum_versions v where v.id=room.curriculum_version_id and v.status='published';
 select i.* into selected from public.course_plan_items i join public.lesson_schedules s on s.course_plan_id=i.course_plan_id and s.lesson_position=i.lesson_position where s.id=room.schedule_id order by i.position limit 1;
 select skill into definition from jsonb_array_elements(document->'units') u, jsonb_array_elements(u->'topics') t, jsonb_array_elements(t->'skills') skill where skill->>'id'=selected.skill_id::text;
 if document->>'subject'<>'Mathematics' or (document->>'academicLevel')::integer<>8 or definition->>'code' not in ('integers','inverse') then raise exception 'No reviewed simulation for this planned skill' using errcode='22023'; end if;
 steps:=public.maya_mock_templates_internal()->(definition->>'code');
 select coalesce(jsonb_agg(edge->'prerequisiteId' order by edge->>'prerequisiteId'),'[]'::jsonb) into prerequisites from jsonb_array_elements(document->'prerequisites') edge where edge->>'skillId'=selected.skill_id::text;
 return jsonb_build_object('schemaVersion',1,'objective',selected.objectives->0,'reviewSkills',prerequisites,'newSkills',jsonb_build_array(selected.skill_id),'steps',steps,'understandingChecks',(select jsonb_agg(s->'question') from jsonb_array_elements(steps) s where s->'question'<>'null'::jsonb),'homeworkIntent',null,'provenance',jsonb_build_object('provider','mock','plannerVersion','mock-planner-1','policyVersion','maya-mock-1','publicationReference',room.curriculum_version_id));
end $$;

create function public.maya_mock_operation(p_schedule_id uuid,p_request_id uuid,p_epoch integer,p_action text,p_speech_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare reservation public.lesson_schedules; room public.lessons; old public.lesson_events; plan jsonb; step jsonb; fp jsonb; payload jsonb; kind text; run uuid; command jsonb;
begin
 if p_request_id is null or p_epoch is null or p_epoch<0 or p_action is null or p_action not in ('start','advance','apply','complete','interrupt','hint','respond','stop') then raise exception 'Invalid simulation request' using errcode='22023'; end if;
 select * into reservation from public.lesson_schedules where id=p_schedule_id;
 if not found then raise exception 'Reservation unavailable' using errcode='42501'; end if;
 perform public.require_classroom_preview(reservation.student_id);
 perform 1 from public.student_profiles where id=reservation.student_id for update;
 select * into room from public.lessons where schedule_id=p_schedule_id and classroom_mode='supervised_preview' for update;
 if room.id is null or not exists(select 1 from private.parent_student_previews where session_id=public.current_auth_session() and ended_at is null and classroom_lesson_id=room.id) then raise exception 'Active classroom preview required' using errcode='42501'; end if;
 fp:=jsonb_build_object('action',p_action,'epoch',p_epoch,'speechId',p_speech_id);
 select * into old from public.lesson_events where lesson_id=room.id and id=p_request_id;
 if found then
  if old.source<>'maya_mock' or old.request_fingerprint is distinct from fp then raise exception 'Conflicting simulation retry' using errcode='22023'; end if;
  return jsonb_build_object('ok',true);
 end if;
 if room.status not in ('active','paused') then raise exception 'Lesson is closed' using errcode='40001'; end if;
 if room.last_seen_at<clock_timestamp()-interval '15 minutes' then perform public.abandon_classroom_internal(room.id); return jsonb_build_object('ok',false,'reason','lesson_closed'); end if;
 if p_action<>'stop' and (room.status<>'active' or room.interruption_epoch<>p_epoch) then raise exception 'Superseded generation' using errcode='40001'; end if;
 if p_action='stop' then
  if room.maya_started_at is null or room.maya_stopped_at is not null then raise exception 'Simulation unavailable' using errcode='22023'; end if;
  update public.lessons set interruption_epoch=interruption_epoch+1,maya_pending=null,maya_stopped_at=clock_timestamp() where id=room.id;
  perform public.append_classroom_internal(room.id,p_request_id,'maya_session_stopped',jsonb_build_object('reason','explicit'),'maya_mock',fp);
  return jsonb_build_object('ok',true);
 end if;
 if room.maya_started_at is not null and room.maya_stopped_at is null and room.maya_started_at<clock_timestamp()-interval '5 minutes' then
  update public.lessons set interruption_epoch=interruption_epoch+1,maya_pending=null,maya_stopped_at=clock_timestamp() where id=room.id;
  perform public.append_classroom_internal(room.id,p_request_id,'maya_session_stopped',jsonb_build_object('reason','duration'),'maya_mock',fp);
  return jsonb_build_object('ok',false,'reason','duration');
 end if;
 if room.event_sequence>=2985 then raise exception 'Classroom history full' using errcode='P5003'; end if;
 if (select count(*) from public.lesson_events where lesson_id=room.id and source='maya_mock' and created_at>clock_timestamp()-interval '1 minute')+(case when p_action in ('advance','apply') then 2 else 1 end)>60 then raise exception 'Simulation rate limit' using errcode='P5002'; end if;
 if p_action='start' then
  if room.maya_started_at is not null or p_speech_id is not null then raise exception 'Simulation already initialized' using errcode='22023'; end if;
  plan:=public.maya_mock_plan_internal(room.id);
  insert into public.lesson_plans(lesson_id,plan) values(room.id,plan);
  insert into public.ai_runs(lesson_id,operation,model,prompt_version,metadata) values(room.id,'mock_teaching','deterministic', 'maya-mock-1', jsonb_build_object('provider','mock','plannerVersion','mock-planner-1','publicationReference',room.curriculum_version_id,'externalRequests',0,'estimatedCostUsd',0,'maxDurationSeconds',300));
  update public.lessons set maya_started_at=clock_timestamp() where id=room.id;
  kind:='maya_session_started'; payload:=jsonb_build_object('provider','mock','policyVersion','maya-mock-1','plannerVersion','mock-planner-1');
 else
  if room.maya_started_at is null or room.maya_stopped_at is not null then raise exception 'Simulation unavailable' using errcode='22023'; end if;
  select lp.plan into plan from public.lesson_plans lp where lp.lesson_id=room.id;
  step:=plan->'steps'->room.maya_step;
  if p_action='advance' then
   if p_speech_id is not null then raise exception 'Unexpected speech reference' using errcode='22023'; end if;
   if room.maya_pending is not null and exists(select 1 from public.lesson_events where lesson_id=room.id and id=room.maya_pending and interruption_epoch=room.interruption_epoch) then raise exception 'Explanation pending' using errcode='40001'; end if;
   -- An interrupted step can be restarted; already committed board state survives.
   if room.maya_pending is null then room.maya_step:=room.maya_step+1; room.maya_applied:=false; end if;
   step:=plan->'steps'->room.maya_step;
   if step is null then raise exception 'Simulation complete' using errcode='22023'; end if;
   update public.lessons set maya_step=room.maya_step,maya_pending=p_request_id,maya_pending_at=clock_timestamp(),maya_applied=room.maya_applied where id=room.id;
   kind:='maya_explanation_started'; payload:=jsonb_build_object('step',room.maya_step,'speechId',p_request_id,'narration',step->'narration','durationMs',step->'durationMs','offsetMs',step->'offsetMs','generation',room.interruption_epoch,'boardAlreadyApplied',room.maya_applied);
   perform public.append_classroom_internal(room.id,p_request_id,kind,payload,'maya_mock',fp);
   if not room.maya_applied then perform public.append_classroom_internal(room.id,gen_random_uuid(),'maya_whiteboard_issued',jsonb_build_object('step',room.maya_step,'speechId',p_request_id,'action',step->'board'),'maya_mock','{}'); end if;
   return jsonb_build_object('ok',true);
  elsif p_action='interrupt' then
   if p_speech_id is distinct from room.maya_pending then raise exception 'Stale speech reference' using errcode='40001'; end if;
   update public.lessons set interruption_epoch=interruption_epoch+1 where id=room.id;
   kind:='maya_interrupted'; payload:=jsonb_build_object('speechId',room.maya_pending);
  elsif p_action in ('apply','complete') then
   if p_speech_id is null or p_speech_id is distinct from room.maya_pending or not exists(select 1 from public.lesson_events where lesson_id=room.id and id=p_speech_id and interruption_epoch=p_epoch) then raise exception 'Stale speech reference' using errcode='40001'; end if;
   if p_action='apply' then
    if room.maya_applied then raise exception 'Board step already applied' using errcode='22023'; end if;
    if clock_timestamp()<room.maya_pending_at+((step->>'offsetMs')::integer*interval '1 millisecond') then raise exception 'Playback offset not reached' using errcode='40001'; end if;
    select id into run from public.ai_runs where lesson_id=room.id and operation='mock_teaching';
    insert into public.tool_calls(ai_run_id,tool_name,metadata) values(run,'show_whiteboard_content',jsonb_build_object('callId',p_request_id,'validated',true,'step',room.maya_step));
    perform public.append_classroom_internal(room.id,gen_random_uuid(),'maya_tool_validated',jsonb_build_object('name','show_whiteboard_content','callId',p_request_id),'maya_mock','{}');
    select event_sequence into room.event_sequence from public.lessons where id=room.id;
    command:=jsonb_build_object('protocolVersion',1,'commandId',p_request_id,'lessonId',room.id,'sequence',room.event_sequence+1,'actor','maya','epoch',p_epoch,'synchronization',jsonb_build_object('speechId',p_speech_id,'anchor','playback_offset','offsetMs',step->'offsetMs'),'action',step->'board');
    kind:='maya_whiteboard_applied';payload:=jsonb_build_object('step',room.maya_step,'speechId',p_speech_id,'command',command);
    update public.lessons set maya_applied=true where id=room.id;
   else
    if not room.maya_applied or clock_timestamp()<room.maya_pending_at+((step->>'durationMs')::integer*interval '1 millisecond') then raise exception 'Narration not complete' using errcode='40001'; end if;
    update public.lessons set maya_pending=null where id=room.id;
    kind:='maya_explanation_completed';payload:=jsonb_build_object('step',room.maya_step,'speechId',p_speech_id,'question',step->'question');
   end if;
  elsif p_action in ('hint','respond') then
   if room.maya_step<0 or p_speech_id is not null then raise exception 'No teaching step' using errcode='22023'; end if;
   if p_action='hint' then kind:='maya_hint';payload:=jsonb_build_object('step',room.maya_step,'text',step->'fallback');
   else kind:='maya_response_simulated';payload:=jsonb_build_object('step',room.maya_step,'text','Simulated learner: please explain another way. Maya: Let us reason through the worked example again. This response is a simulation, not an assessed answer.'); end if;
  end if;
 end if;
 perform public.append_classroom_internal(room.id,p_request_id,kind,payload,'maya_mock',fp);
 update public.lessons set last_seen_at=clock_timestamp() where id=room.id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.maya_mock_plan_internal(uuid), public.maya_mock_operation(uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.maya_mock_operation(uuid,uuid,integer,text,uuid) to authenticated;

create or replace function public.guard_classroom_event() returns trigger language plpgsql security definer set search_path='' as $$
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
  elsif new.source='maya_mock' then
   if octet_length(new.payload::text)>16384 or not extensions.jsonb_matches_schema(public.maya_mock_event_schema_internal(),jsonb_build_object('kind',new.event_type,'payload',new.payload)) then raise exception 'Invalid mock teaching event' using errcode='22023'; end if;
   if new.event_type='maya_whiteboard_applied' and ((new.payload->'command'->>'lessonId')::uuid<>room.id or (new.payload->'command'->>'epoch')::integer<>room.interruption_epoch or (new.payload->'command'->>'sequence')::integer<>room.event_sequence) then raise exception 'Invalid mock board envelope' using errcode='22023'; end if;
  else raise exception 'Invalid classroom source' using errcode='22023'; end if;
 elsif new.sequence is not null then raise exception 'Preview protocol cannot write instructional events' using errcode='22023'; end if;
 return new;
end $$;

create function public.guard_maya_plan_internal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op in ('UPDATE','DELETE') and old.plan->'provenance'->>'provider'='mock' then raise exception 'Simulation plan is immutable' using errcode='42501'; end if;
 if tg_op='DELETE' then return old; end if;
 if exists(select 1 from public.lessons where id=new.lesson_id and classroom_mode='supervised_preview') and new.plan is distinct from public.maya_mock_plan_internal(new.lesson_id) then raise exception 'Simulation plan must match pinned deterministic planner' using errcode='22023'; end if;
 return new;
end $$;
create trigger guard_maya_plan before insert or update or delete on public.lesson_plans for each row execute function public.guard_maya_plan_internal();
revoke all on function public.guard_maya_plan_internal() from public,anon,authenticated;
create function public.guard_maya_closure_internal() returns trigger language plpgsql set search_path='' as $$
begin
 if new.classroom_mode='supervised_preview' and new.status in ('ended','abandoned') and new.maya_started_at is not null then
  new.maya_stopped_at:=coalesce(new.maya_stopped_at,clock_timestamp()); new.maya_pending:=null;
 end if;
 return new;
end $$;
create trigger guard_maya_closure before update on public.lessons for each row execute function public.guard_maya_closure_internal();
revoke all on function public.guard_maya_closure_internal() from public,anon,authenticated;

create function public.maya_mock_tool_audit(p_schedule_id uuid,p_request_id uuid,p_name text,p_outcome text) returns void
language plpgsql security definer set search_path='' as $$
declare reservation public.lesson_schedules; room public.lessons; old public.lesson_events; fp jsonb; run uuid;
begin
 if p_request_id is null or p_name is null or p_name not in ('get_lesson_context','get_current_objective','get_relevant_skills','get_current_board_state','show_whiteboard_content','write_whiteboard_math','highlight_whiteboard_region','ask_student_question','request_student_explanation','unapproved') or p_outcome is null or p_outcome not in ('validated','rejected') or (p_name='unapproved' and p_outcome<>'rejected') then raise exception 'Invalid tool audit' using errcode='22023'; end if;
 select * into reservation from public.lesson_schedules where id=p_schedule_id;
 if not found then raise exception 'Reservation unavailable' using errcode='42501'; end if;
 perform public.require_classroom_preview(reservation.student_id);
 perform 1 from public.student_profiles where id=reservation.student_id for update;
 select * into room from public.lessons where schedule_id=p_schedule_id and classroom_mode='supervised_preview' for update;
 if room.id is null or room.status<>'active' or room.maya_started_at is null or room.maya_stopped_at is not null or room.maya_started_at<clock_timestamp()-interval '5 minutes' or not exists(select 1 from private.parent_student_previews where session_id=public.current_auth_session() and ended_at is null and classroom_lesson_id=room.id) then raise exception 'Active mock tool session required' using errcode='42501'; end if;
 fp:=jsonb_build_object('name',p_name,'outcome',p_outcome);
 select * into old from public.lesson_events where lesson_id=room.id and id=p_request_id;
 if found then
  if old.source<>'maya_mock' or old.request_fingerprint is distinct from fp then raise exception 'Conflicting tool retry' using errcode='22023'; end if;
  return;
 end if;
 if room.event_sequence>=2985 then raise exception 'Classroom history full' using errcode='P5003'; end if;
 if (select count(*) from public.lesson_events where lesson_id=room.id and source='maya_mock' and created_at>clock_timestamp()-interval '1 minute')+2>60 then raise exception 'Tool rate limit' using errcode='P5002'; end if;
 select id into run from public.ai_runs where lesson_id=room.id and operation='mock_teaching';
 insert into public.tool_calls(ai_run_id,tool_name,metadata) values(run,p_name,jsonb_build_object('callId',p_request_id,'outcome',p_outcome));
 perform public.append_classroom_internal(room.id,gen_random_uuid(),'maya_tool_call',jsonb_build_object('callId',p_request_id,'name',p_name,'outcome','proposed'),'maya_mock','{}');
 perform public.append_classroom_internal(room.id,p_request_id,'maya_tool_call',jsonb_build_object('callId',p_request_id,'name',p_name,'outcome',p_outcome),'maya_mock',fp);
end $$;
revoke all on function public.maya_mock_tool_audit(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.maya_mock_tool_audit(uuid,uuid,text,text) to authenticated;
