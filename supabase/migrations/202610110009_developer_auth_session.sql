-- A signed JWT session claim alone is not proof of a retained Auth session.
-- This predicate grants no developer role or paid capability; local operator
-- allowlisting and a separately approved live-test manifest remain mandatory.
create function public.is_current_auth_session_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from auth.users u join auth.sessions s on s.user_id=u.id
   where u.id=auth.uid() and u.email_confirmed_at is not null
     and s.id=public.current_auth_session()
     and (s.not_after is null or s.not_after>now())
 )
$$;
revoke all on function public.is_current_auth_session_active() from public,anon,authenticated;
grant execute on function public.is_current_auth_session_active() to authenticated;
