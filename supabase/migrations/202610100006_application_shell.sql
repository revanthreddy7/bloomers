-- A supervised preview narrows the current parent Auth session at the database
-- boundary. This is access-control state, not a second learning/enrollment store.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.parent_student_previews (
  session_id uuid primary key,
  parent_id uuid not null references public.parent_profiles(user_id),
  student_id uuid not null references public.student_profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index preview_parent_idx on private.parent_student_previews(parent_id);
create index preview_student_idx on private.parent_student_previews(student_id);
alter table private.parent_student_previews enable row level security;
revoke all on private.parent_student_previews from public, anon, authenticated;

create function public.current_auth_session() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  return nullif(auth.jwt()->>'session_id','')::uuid;
exception when invalid_text_representation then return null;
end $$;

create function public.active_preview_student() returns uuid
language sql stable security definer set search_path = '' as $$
  select student_id from private.parent_student_previews
  where session_id=public.current_auth_session() and parent_id=auth.uid() and ended_at is null
$$;

create or replace function public.is_parent_of(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.parent_student_relationships r
    where r.parent_id=auth.uid() and r.student_id=p_student)
    and (public.active_preview_student() is null or public.active_preview_student()=p_student)
$$;

-- Every existing parent mutation uses this gate. Serialize entry/exit and writes
-- for the same real session so an overlapping mutation cannot race preview entry.
create or replace function public.require_verified_parent() returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_session uuid := public.current_auth_session();
begin
  if actor is null or not exists (
    select 1 from auth.users a join public.users u on u.id=a.id
    join public.parent_profiles p on p.user_id=u.id
    where a.id=actor and a.email_confirmed_at is not null and u.role='PARENT'
  ) then raise exception 'Verified parent required' using errcode='42501'; end if;
  if current_session is not null then
    perform pg_advisory_xact_lock(hashtextextended(current_session::text,44));
  end if;
  if public.active_preview_student() is not null then
    raise exception 'Return to parent mode first' using errcode='42501';
  end if;
  return actor;
end $$;

create function public.begin_student_preview(p_student_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.require_verified_parent(); current_session uuid := public.current_auth_session();
begin
  if current_session is null or not exists(select 1 from auth.sessions where id=current_session and user_id=actor)
    then raise exception 'Active parent session required' using errcode='42501'; end if;
  perform 1 from public.parent_student_relationships where parent_id=actor and student_id=p_student_id for share;
  if not found then raise exception 'Student unavailable' using errcode='42501'; end if;
  insert into private.parent_student_previews(session_id,parent_id,student_id)
    values(current_session,actor,p_student_id)
    on conflict(session_id) do update set student_id=excluded.student_id,started_at=now(),ended_at=null;
  insert into public.audit_logs(actor_id,action,metadata)
    values(actor,'preview.started',jsonb_build_object('student_id',p_student_id));
  return p_student_id;
end $$;

create function public.end_student_preview() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_session uuid := public.current_auth_session(); selected uuid;
begin
  if actor is null or current_session is null or not exists (
    select 1 from auth.users a join public.users u on u.id=a.id
    join public.parent_profiles p on p.user_id=u.id join auth.sessions s on s.user_id=a.id
    where a.id=actor and a.email_confirmed_at is not null and u.role='PARENT' and s.id=current_session
  ) then raise exception 'Active parent session required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(current_session::text,44));
  update private.parent_student_previews set ended_at=now()
    where session_id=current_session and parent_id=actor and ended_at is null returning student_id into selected;
  if selected is not null then
    insert into public.audit_logs(actor_id,action,metadata)
      values(actor,'preview.ended',jsonb_build_object('student_id',selected));
  end if;
  return selected;
end $$;

-- Parent-only account, consent and report data is unavailable in preview even
-- when a caller bypasses the Next UI and reads through the public REST API.
create policy "parent mode only" on public.users as restrictive for select to authenticated using (public.active_preview_student() is null);
create policy "parent mode only" on public.parent_profiles as restrictive for select to authenticated using (public.active_preview_student() is null);
create policy "parent mode only" on public.consents as restrictive for select to authenticated using (public.active_preview_student() is null);
create policy "parent mode only" on public.parent_reports as restrictive for select to authenticated using (public.active_preview_student() is null);
create policy "preview selected relationship" on public.parent_student_relationships as restrictive for select to authenticated using (public.active_preview_student() is null or student_id=public.active_preview_student());
-- The parent role row is hidden in preview, so the earlier catalog policy's
-- ordinary parent branch cannot apply. Open only this student's exact pins.
create policy "preview enrolled publication" on public.curriculum_versions for select to authenticated using (
  status='published' and public.active_preview_student() is not null
  and exists(select 1 from public.student_courses c where c.student_id=public.active_preview_student()
    and c.curriculum_version_id=curriculum_versions.id)
);

revoke all on function public.current_auth_session(), public.active_preview_student(), public.begin_student_preview(uuid), public.end_student_preview() from public, anon, authenticated;
grant execute on function public.active_preview_student(), public.begin_student_preview(uuid), public.end_student_preview() to authenticated;
-- Policies call the public scope helper; session extraction remains internal.
