-- My profile (Part B, 2026-10-23): every member opens their own profile page
-- (/me) and sees their role, work, earnings and agreements, edits their own
-- personal details, and never sees the rating, Access or History.
--
-- 1. os_people() returns everyone to People & Access admins, as before, and
--    now the caller's own row to anyone else in the workspace (it used to
--    refuse them). The row is about them: their name, status, job role id,
--    Google connection and job counts.
-- 2. A member reads the job role (os_bundles row) assigned to them, so the
--    Role card can name it. Every other job role stays admins only.
-- What else the page shows was already theirs to read: os_person_details,
-- os_person_work, os_earnings, os_commission_rates, their job_assignments and
-- the Gio Sign envelopes they are a recipient of. os_person_rating and
-- os_audit_log stay admins only.

create or replace function public.os_people(_tenant_id uuid)
 returns table(member_id uuid, user_id uuid, email text, first_name text, last_name text, avatar_url text, member_status text, system_role text, user_type text, last_sign_in_at timestamp with time zone, profile_status text, bundle_id uuid, google_email text, google_status text, active_jobs integer, closed_jobs integer, grants jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  -- Admins see everyone, anyone else only themself.
  return query
  select
    m.id,
    m.user_id,
    coalesce(p.email, u.email, m.invited_email)::text,
    p.first_name,
    p.last_name,
    p.avatar_url,
    m.user_status::text,
    m.system_role::text,
    m.user_type::text,
    u.last_sign_in_at,
    coalesce(op.status, 'active'),
    op.bundle_id,
    g.email_address,
    case
      when g.id is null then 'not_connected'
      when g.sync_status in ('expired', 'error', 'revoked', 'auth_required') then 'reconnect'
      else 'connected'
    end,
    coalesce(jobs.active, 0)::int,
    coalesce(jobs.closed, 0)::int,
    coalesce(gr.grants, '[]'::jsonb)
  from public.members m
  left join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  left join public.os_person_profile op on op.tenant_id = m.tenant_id and op.user_id = m.user_id
  left join lateral (
    select i.id, i.email_address, i.sync_status
    from public.user_mail_identities i
    where i.user_id = m.user_id and i.is_active
    order by i.is_default desc nulls last, i.updated_at desc
    limit 1
  ) g on true
  left join lateral (
    select
      count(distinct ja.job_id) filter (where j.status in ('draft', 'open')) as active,
      count(distinct ja.job_id) filter (where j.status in ('closed', 'archived')) as closed
    from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    where ja.user_id = m.user_id and ja.deleted_at is null and j.tenant_id = m.tenant_id
  ) jobs on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'app', a.app_key, 'role', a.role, 'status', a.status,
      'sync_error', a.sync_error, 'granted_at', a.granted_at
    ) order by a.app_key) as grants
    from public.os_app_grants a
    where a.tenant_id = m.tenant_id and a.user_id = m.user_id and a.status <> 'revoked'
  ) gr on true
  where m.tenant_id = _tenant_id
    and (public.is_os_admin(_tenant_id) or (m.user_id = auth.uid() and auth.uid() is not null));
end;
$function$;

-- The job role assigned to the caller in a workspace (none for anyone else).
create or replace function public.os_my_bundle_id(_tenant_id uuid)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select op.bundle_id from public.os_person_profile op
  where op.tenant_id = _tenant_id and op.user_id = auth.uid() and auth.uid() is not null
$function$;
revoke execute on function public.os_my_bundle_id(uuid) from public, anon;
grant execute on function public.os_my_bundle_id(uuid) to authenticated, service_role;

create policy os_bundles_read_own on public.os_bundles
  for select to authenticated
  using (id = public.os_my_bundle_id(tenant_id));
