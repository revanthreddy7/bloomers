begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('anon','public.save_curriculum_draft(uuid,uuid,integer,jsonb)','EXECUTE'),'anonymous draft RPC revoked');
select ok(not has_function_privilege('authenticated','public.validate_curriculum_document(jsonb,boolean)','EXECUTE'),'internal validator not a public RPC');
insert into auth.users(id,email_confirmed_at,raw_user_meta_data) values
 ('90000000-0000-0000-0000-000000000001',now(),'{}'),
 ('90000000-0000-0000-0000-000000000002',now(),'{"role":"ADMIN"}'),
 ('90000000-0000-0000-0000-000000000003',now(),'{}'),
 ('90000000-0000-0000-0000-000000000004',null,'{}');
insert into public.users(id,role) values
 ('90000000-0000-0000-0000-000000000001','ADMIN'),
 ('90000000-0000-0000-0000-000000000002','PARENT'),
 ('90000000-0000-0000-0000-000000000003','STUDENT'),
 ('90000000-0000-0000-0000-000000000004','ADMIN');
create temporary table fixture as select document from public.curriculum_versions where version=1;
grant select on fixture to authenticated;
create temporary table draft(id uuid);grant all on draft to authenticated;
create temporary table incomplete(id uuid);grant all on incomplete to authenticated;
select is((select count(*)::integer from public.curriculum_versions),1,'one repeatable published seed');
select lives_ok($$select public.validate_curriculum_document((select document from fixture),true)$$,'seed is ready');
select throws_ok($$select public.validate_curriculum_document(null)$$,'22023',null,'null document rejected');
select throws_ok($$select public.validate_curriculum_document(jsonb_set((select document from fixture),'{units,0,topics,0,skills,0,masteryThreshold}','1.2'))$$,'22023',null,'mastery bounded');
select throws_ok($$select public.validate_curriculum_document(jsonb_set((select document from fixture),'{units,0,topics,0,skills,1,position}','1'))$$,'22023',null,'duplicate positions rejected');
select throws_ok($$select public.validate_curriculum_document((select document from fixture)||'{"systemPrompt":"secret"}')$$,'22023',null,'internal prompt rejected');
select throws_ok($$select public.validate_curriculum_document(jsonb_set((select document from fixture),'{units,0,topics,0,content,practiceQuestions,0,answer}','13'))$$,'22023',null,'private answer field rejected');
select throws_ok($$select public.validate_curriculum_document(jsonb_set((select document from fixture),'{prerequisites}','[{"skillId":"00000000-0000-0000-0000-000000000011","prerequisiteId":"00000000-0000-0000-0000-000000000011"}]'))$$,'22023',null,'self dependency rejected');
select throws_ok($$select public.validate_curriculum_document(jsonb_set((select document from fixture),'{prerequisites}','[{"skillId":"00000000-0000-0000-0000-000000000011","prerequisiteId":"00000000-0000-0000-0000-000000000099"}]'))$$,'22023',null,'scope rejected');
select throws_ok($$select public.validate_curriculum_document(jsonb_set((select document from fixture),'{prerequisites}',(select document->'prerequisites' from fixture)||'[{"skillId":"00000000-0000-0000-0000-000000000011","prerequisiteId":"00000000-0000-0000-0000-000000000015"}]'))$$,'22023',null,'cycle rejected');
select throws_ok($$select public.validate_curriculum_document(jsonb_set((select document from fixture),'{prerequisites}',(select document->'prerequisites' from fixture)||(select document->'prerequisites'->0 from fixture)))$$,'22023',null,'duplicate edge rejected');
select throws_ok($$select public.validate_curriculum_document(jsonb_set((select document from fixture),'{units,0,topics,0,content,explanations}','[]'),true)$$,'22023',null,'publication completeness checked');
insert into public.student_profiles(id,display_name) values('90000000-0000-0000-0000-000000000100','Synthetic');
insert into public.student_courses(id,student_id,course_id) values('90000000-0000-0000-0000-000000000101','90000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000002');
insert into public.course_plans(id,student_course_id) values('90000000-0000-0000-0000-000000000102','90000000-0000-0000-0000-000000000101');
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
insert into draft select public.save_curriculum_draft('00000000-0000-0000-0000-000000000002',null,0,(select document from fixture));
select is((select status from public.curriculum_versions where id=(select id from draft)),'draft','admin creates draft');
select is((select version from public.curriculum_versions where id=(select id from draft)),2,'version sequence');
select lives_ok($$select public.save_curriculum_draft('00000000-0000-0000-0000-000000000002',(select id from draft),1,jsonb_set((select document from fixture),'{name}','"Updated algebra"'))$$,'admin updates draft');
select is((select revision from public.curriculum_versions where id=(select id from draft)),2,'revision advances');
select throws_ok($$select public.save_curriculum_draft('90000000-0000-0000-0000-000000000500',null,0,(select document from fixture))$$,'22023',null,'existing identities cannot move to a different course');
select lives_ok($$select public.save_curriculum_draft('90000000-0000-0000-0000-000000000501',null,0,jsonb_set(jsonb_set(jsonb_set((select document from fixture),'{name}','"Secret draft course"'),'{units}','[]'),'{prerequisites}','[]'))$$,'empty draft course can be created');
select throws_ok($$select public.save_curriculum_draft('00000000-0000-0000-0000-000000000002',(select id from draft),1,(select document from fixture))$$,'40001',null,'stale mutation rejected');
select throws_ok($$select public.publish_curriculum_version((select id from draft),null)$$,'22023',null,'null revision cannot bypass locking');
select throws_ok($$select public.publish_curriculum_version((select id from draft),1)$$,'40001',null,'stale publication rejected');
insert into incomplete select public.save_curriculum_draft('00000000-0000-0000-0000-000000000002',null,0,jsonb_set(jsonb_set((select document from fixture),'{units,0,id}','"90000000-0000-0000-0000-000000000600"'),'{units,0,topics,0,content,explanations}','[]'));
select throws_ok($$select public.publish_curriculum_version((select id from incomplete),1)$$,'22023',null,'RPC rejects incomplete publication');
select throws_ok($$update public.curriculum_versions set document='{}'$$,'42501',null,'admin has no direct write');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
select is((select count(*)::integer from public.curriculum_versions),1,'parent sees publication only');
select is((select count(*)::integer from public.courses where id='90000000-0000-0000-0000-000000000501'),0,'legacy catalog hides draft-only course identity');
select is((select count(*)::integer from public.units where id='90000000-0000-0000-0000-000000000600'),0,'legacy catalog hides draft-only unit identity');
select is((select count(*)::integer from public.questions),0,'answers remain private');
select throws_ok($$select public.save_curriculum_draft('00000000-0000-0000-0000-000000000002',null,0,(select document from fixture))$$,'42501',null,'parent metadata ADMIN cannot create draft');
select throws_ok($$select public.publish_curriculum_version((select id from draft),2)$$,'42501',null,'parent cannot publish');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
select is((select count(*)::integer from public.curriculum_versions),0,'student cannot read drafts or publications in explorer');
select throws_ok($$select public.publish_curriculum_version((select id from draft),2)$$,'42501',null,'student cannot publish');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
select throws_ok($$select public.publish_curriculum_version((select id from draft),2)$$,'42501',null,'unverified admin cannot publish');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.publish_curriculum_version((select id from draft),2)$$,'explicit publication');
select lives_ok($$select public.publish_curriculum_version((select id from draft),2)$$,'publication retry idempotent');
select throws_ok($$select public.save_curriculum_draft('00000000-0000-0000-0000-000000000002',(select id from draft),2,(select document from fixture))$$,'42501',null,'published save denied');
reset role;
select is((select count(*)::integer from public.audit_logs where action='curriculum.published' and metadata->>'version_id'=(select id::text from draft)),1,'publication audited once');
select throws_ok($$update public.curriculum_versions set document=(select document from fixture) where id=(select id from draft)$$,'42501',null,'owner cannot rewrite publication');
select throws_ok($$delete from public.curriculum_versions where id=(select id from draft)$$,'42501',null,'publication cannot be deleted');
select throws_ok($$delete from public.skills where id='00000000-0000-0000-0000-000000000011'$$,'42501',null,'published skill identity cannot be deleted');
select throws_ok($$update public.skills set code='changed' where id='00000000-0000-0000-0000-000000000011'$$,'42501',null,'published skill code cannot change');
select is((select curriculum_version_id from public.student_courses where id='90000000-0000-0000-0000-000000000101'),'00000000-0000-0000-0000-000000000101'::uuid,'new publication does not change existing enrollment');
select throws_ok($$update public.student_courses set curriculum_version_id=(select id from draft) where id='90000000-0000-0000-0000-000000000101'$$,'42501',null,'silent migration prohibited');
select is((select curriculum_version_id from public.course_plans where id='90000000-0000-0000-0000-000000000102'),'00000000-0000-0000-0000-000000000101'::uuid,'new publication does not change historical plan');
select throws_ok($$update public.course_plans set curriculum_version_id=(select id from draft)$$,'42501',null,'historical plan cannot be migrated');
set local role anon;
select throws_ok($$select * from public.curriculum_versions$$,'42501',null,'anonymous cannot read');
select throws_ok($$select public.save_curriculum_draft(null,null,0,null)$$,'42501',null,'anonymous cannot author');
reset role;
select * from finish();rollback;
