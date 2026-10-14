-- People & Access: a mail connection in 'auth_required' needs reconnecting too
-- (2026-10-14). Same function as 20261014175030 with that one status added.

create or replace function public.os_people(_tenant_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  member_status text,
  system_role text,
  user_type text,
  last_sign_in_at timestamptz,
  profile_status text,
  bundle_id uuid,
  google_email text,
  google_status text,
  active_jobs int,
  closed_jobs int,
  grants jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only admins can see People & Access.' using errcode = '42501';
  end if;

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
  where m.tenant_id = _tenant_id;
end;
$function$;

