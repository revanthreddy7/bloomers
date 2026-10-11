-- Identity mutations are narrowly scoped RPCs. No direct client write grants.
alter table public.student_profiles
  add column grade integer check (grade between 1 and 12),
  add column learning_goals text check (char_length(learning_goals) <= 500),
  add column created_by uuid references public.parent_profiles(user_id),
  add column creation_request_id uuid,
  add constraint student_creation_request_key unique (created_by, creation_request_id),
  add constraint student_name_length check (char_length(btrim(display_name)) between 1 and 80);
create index student_created_by_idx on public.student_profiles(created_by);

create table public.consent_policies (
  consent_type text not null,
  version text not null,
  description text not null,
  approved boolean not null default false,
  primary key (consent_type, version)
);
alter table public.consent_policies enable row level security;
grant select on public.consent_policies to authenticated;
grant all on public.consent_policies to service_role;
create policy "read capability policies" on public.consent_policies for select to authenticated using (true);
insert into public.consent_policies(consent_type,version,description) values
('ai_tutoring','draft-v1','AI tutoring sessions. Policy wording and eligibility await approval.'),
('microphone','draft-v1','Microphone use for lesson interaction. Policy wording and eligibility await approval.'),
('camera_analysis','draft-v1','Selected images for educational analysis. Policy wording and eligibility await approval.'),
('uploads','draft-v1','Student work uploads. Policy wording and eligibility await approval.'),
('recording','draft-v1','Optional recording. Retention and policy wording await approval.'),
('pilot','legacy-unversioned','Legacy Phase 0 fixture category; not an approved policy.');
alter table public.consents
  add column policy_version text not null default 'legacy-unversioned',
  add column source text not null default 'legacy',
  add column request_id uuid,
  add column event_order bigint generated always as identity unique,
  add constraint consent_policy_fk foreign key (consent_type,policy_version) references public.consent_policies(consent_type,version),
  add constraint consent_request_key unique (parent_id,request_id);
create index consent_student_time_idx on public.consents(student_id,event_order desc);
create index consent_policy_idx on public.consents(consent_type,policy_version);
create index identity_audit_actor_time_idx on public.audit_logs(actor_id,created_at);

create function public.require_verified_parent() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from auth.users a join public.users u on u.id=a.id
    join public.parent_profiles p on p.user_id=u.id
    where a.id=actor and a.email_confirmed_at is not null and u.role='PARENT'
  ) then raise exception 'Verified parent required' using errcode='42501'; end if;
  return actor;
end $$;

create function public.provision_parent() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); app_role_value public.app_role;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null)
    then raise exception 'Verified identity required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  insert into public.users(id,role) values (actor,'PARENT') on conflict (id) do nothing;
  select role into app_role_value from public.users where id=actor;
  if app_role_value <> 'PARENT' then raise exception 'Parent access required' using errcode='42501'; end if;
  insert into public.parent_profiles(user_id,display_name) values (actor,'Parent') on conflict(user_id) do nothing;
  return actor;
end $$;

-- Atomic per-parent mutation throttling. Audit metadata contains no child content.
create function public.limit_identity_mutations(actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  if (select count(*) from public.audit_logs where actor_id=actor
      and action like 'identity.%' and created_at > now()-interval '1 minute') >= 30
    then raise exception 'Please wait before trying again' using errcode='P0001'; end if;
end $$;

create function public.create_parent_student(p_request_id uuid,p_display_name text,p_grade integer,p_learning_goals text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.require_verified_parent(); existing public.student_profiles; created uuid;
begin
  if p_request_id is null or p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 80
    or p_grade is null or p_grade not between 1 and 12 or char_length(p_learning_goals)>500
    then raise exception 'Invalid student details' using errcode='22023'; end if;
  perform public.limit_identity_mutations(actor);
  select * into existing from public.student_profiles where created_by=actor and creation_request_id=p_request_id;
  if found then
    if existing.display_name <> btrim(p_display_name) or existing.grade <> p_grade
       or existing.learning_goals is distinct from nullif(btrim(p_learning_goals),'')
      then raise exception 'Request already used with different details' using errcode='22023'; end if;
    return existing.id;
  end if;
  insert into public.student_profiles(display_name,grade,learning_goals,created_by,creation_request_id)
    values (btrim(p_display_name),p_grade,nullif(btrim(p_learning_goals),''),actor,p_request_id) returning id into created;
  insert into public.parent_student_relationships(parent_id,student_id) values (actor,created);
  insert into public.audit_logs(actor_id,action,metadata) values (actor,'identity.student_created',jsonb_build_object('student_id',created));
  return created;
end $$;

create function public.update_parent_student(p_student_id uuid,p_display_name text,p_grade integer,p_learning_goals text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.require_verified_parent();
begin
  if not public.is_parent_of(p_student_id) then raise exception 'Student unavailable' using errcode='42501'; end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 80
    or p_grade is null or p_grade not between 1 and 12 or char_length(p_learning_goals)>500
    then raise exception 'Invalid student details' using errcode='22023'; end if;
  perform public.limit_identity_mutations(actor);
  -- Serialize relationship revocation with this authorized mutation.
  perform 1 from public.parent_student_relationships where parent_id=actor and student_id=p_student_id for share;
  if not found then raise exception 'Student unavailable' using errcode='42501'; end if;
  update public.student_profiles set display_name=btrim(p_display_name),grade=p_grade,learning_goals=nullif(btrim(p_learning_goals),'') where id=p_student_id;
  insert into public.audit_logs(actor_id,action,metadata) values (actor,'identity.student_updated',jsonb_build_object('student_id',p_student_id));
end $$;

create function public.record_parent_consent(p_request_id uuid,p_student_id uuid,p_consent_type text,p_policy_version text,p_granted boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.require_verified_parent(); existing public.consents; approved_policy boolean; created uuid;
begin
  if p_request_id is null or p_granted is null then raise exception 'Invalid consent decision' using errcode='22023'; end if;
  perform public.limit_identity_mutations(actor);
  perform 1 from public.parent_student_relationships where parent_id=actor and student_id=p_student_id for share;
  if not found then raise exception 'Student unavailable' using errcode='42501'; end if;
  select * into existing from public.consents where parent_id=actor and request_id=p_request_id;
  if found then
    if existing.student_id <> p_student_id or existing.consent_type <> p_consent_type
       or existing.policy_version <> p_policy_version or existing.granted <> p_granted
      then raise exception 'Request already used with different details' using errcode='22023'; end if;
    return existing.id;
  end if;
  select approved into approved_policy from public.consent_policies where consent_type=p_consent_type and version=p_policy_version for share;
  if not found or p_consent_type='pilot' then raise exception 'Unknown policy' using errcode='22023'; end if;
  if p_granted and not approved_policy then raise exception 'Policy approval pending' using errcode='22023'; end if;
  insert into public.consents(parent_id,student_id,consent_type,policy_version,granted,source,request_id)
    values(actor,p_student_id,p_consent_type,p_policy_version,p_granted,'parent_portal',p_request_id) returning id into created;
  insert into public.audit_logs(actor_id,action,metadata) values(actor,'identity.consent_recorded',jsonb_build_object('student_id',p_student_id,'consent_id',created));
  return created;
end $$;

create function public.protect_consent_history() returns trigger language plpgsql set search_path = '' as $$
begin
  -- Only the database owner can perform reviewed maintenance/deletion workflows.
  if current_user <> 'postgres' then raise exception 'Consent history is append-only' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger consent_history_immutable before update or delete on public.consents for each row execute function public.protect_consent_history();

revoke all on function public.require_verified_parent(), public.provision_parent(), public.limit_identity_mutations(uuid), public.create_parent_student(uuid,text,integer,text), public.update_parent_student(uuid,text,integer,text), public.record_parent_consent(uuid,uuid,text,text,boolean), public.protect_consent_history() from public,anon,authenticated;
grant execute on function public.provision_parent(), public.create_parent_student(uuid,text,integer,text), public.update_parent_student(uuid,text,integer,text), public.record_parent_consent(uuid,uuid,text,text,boolean) to authenticated;

-- A policy version's wording cannot change after approval or recorded decisions.
create function public.protect_policy_history() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.consent_type,new.version,new.description) is distinct from (old.consent_type,old.version,old.description)
    and (old.approved or exists(select 1 from public.consents where consent_type=old.consent_type and policy_version=old.version))
    then raise exception 'Create a new policy version instead' using errcode='42501'; end if;
  return new;
end $$;
create trigger policy_version_immutable before update on public.consent_policies for each row execute function public.protect_policy_history();
revoke all on function public.protect_policy_history() from public,anon,authenticated;
