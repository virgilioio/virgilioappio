-- External users (Allan, 2026-10-24). Customers who join Virgilio's workspace
-- to take part as hiring managers or interviewers. Virgilio people always use
-- an @virgilio.tech address, so in Virgilio's workspace the address decides:
-- anyone else is external. Externals use Gio ATS only and none of the People &
-- Access information applies to them: they never see the team's birthdays,
-- holidays or useful links, the dashboard doesn't count them, nobody keeps
-- personal details, bank details, tax IDs, a work profile, a rating or a job
-- role for them, they get no other apps, they can't be admins, and they can't
-- hold a Recruiter or Sourcer seat or be credited on a hire.
-- Errors: GEX01 (admin), GEX02 (internal-only information), GEX03 (seats and credit).

-- 1. Who is external.
create or replace function public.os_is_external(_tenant_id uuid, _user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.members m
    where m.tenant_id = _tenant_id and m.user_id = _user_id and m.user_type::text = 'external');
$function$;
revoke all on function public.os_is_external(uuid, uuid) from public, anon;
grant execute on function public.os_is_external(uuid, uuid) to authenticated, service_role;

-- 2. In Virgilio's workspace the email address decides member or external.
create or replace function public.members_z_external()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  addr text;
begin
  if new.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' and new.user_type::text in ('member', 'external') then
    select p.email into addr from public.profiles p where p.user_id = new.user_id;
    addr := lower(btrim(coalesce(addr, new.invited_email, '')));
    if addr like '%@%' then
      new.user_type := (case when addr like '%@virgilio.tech' then 'member' else 'external' end)::public.user_type_enum;
    end if;
  end if;
  if new.user_type::text = 'external' and new.system_role::text = 'admin' then
    raise exception 'People outside Virgilio can''t be admins. They take part as hiring managers or interviewers.'
      using errcode = 'GEX01';
  end if;
  return new;
end;
$function$;

create or replace trigger members_z_external
  before insert or update of user_type, system_role, invited_email, user_id, tenant_id on public.members
  for each row execute function public.members_z_external();

-- Today's client accounts in Virgilio's workspace.
update public.members m
set user_type = 'external'
from public.profiles p
where p.user_id = m.user_id
  and m.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
  and m.user_type::text = 'member'
  and lower(coalesce(p.email, m.invited_email, '')) like '%@%'
  and lower(coalesce(p.email, m.invited_email, '')) not like '%@virgilio.tech';
update public.members m
set user_type = 'external'
where m.user_id is null
  and m.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
  and m.user_type::text = 'member'
  and lower(coalesce(m.invited_email, '')) like '%@%'
  and lower(m.invited_email) not like '%@virgilio.tech';

-- 3. People & Access information is for Virgilio people only.
create or replace function public.os_refuse_external()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- A job role is the only thing os_person_profile keeps that doesn't apply.
  if tg_table_name = 'os_person_profile' then
    if new.bundle_id is null then
      return new;
    end if;
  end if;
  if public.os_is_external(new.tenant_id, new.user_id) then
    raise exception 'This person is outside Virgilio, so People & Access keeps nothing for them.'
      using errcode = 'GEX02';
  end if;
  return new;
end;
$function$;

create or replace trigger a0_os_person_details_external before insert or update on public.os_person_details
  for each row execute function public.os_refuse_external();
create or replace trigger a0_os_person_work_external before insert or update on public.os_person_work
  for each row execute function public.os_refuse_external();
create or replace trigger a0_os_person_rating_external before insert or update on public.os_person_rating
  for each row execute function public.os_refuse_external();
create or replace trigger a0_os_person_profile_external before insert or update on public.os_person_profile
  for each row execute function public.os_refuse_external();
create or replace trigger a0_os_person_bank_external before insert or update on public.os_person_bank
  for each row execute function public.os_refuse_external();
create or replace trigger a0_os_person_tax_ids_external before insert or update on public.os_person_tax_ids
  for each row execute function public.os_refuse_external();

-- Externals use Gio ATS only.
create or replace function public.os_app_grants_external()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.app_key <> 'ats' and new.status <> 'revoked' and public.os_is_external(new.tenant_id, new.user_id) then
    raise exception 'People outside Virgilio use Gio ATS only.' using errcode = 'GEX02';
  end if;
  return new;
end;
$function$;
create or replace trigger a0_os_app_grants_external before insert or update on public.os_app_grants
  for each row execute function public.os_app_grants_external();

-- 4. Hiring managers and interviewers only, never credited on a hire.
create or replace function public.job_assignments_z_external()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  who text;
begin
  if new.role::text in ('recruiter', 'sourcer') and new.deleted_at is null and exists (
      select 1 from public.jobs j
      where j.id = new.job_id and public.os_is_external(j.tenant_id, new.user_id)) then
    select coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.email, 'This person')
      into who from public.profiles p where p.user_id = new.user_id;
    raise exception '% is outside Virgilio, so they can be a hiring manager or interviewer, not a %.',
      coalesce(who, 'This person'), case when new.role::text = 'sourcer' then 'Sourcer' else 'Recruiter' end
      using errcode = 'GEX03';
  end if;
  return new;
end;
$function$;
create or replace trigger job_assignments_z_external before insert or update of role, user_id, deleted_at on public.job_assignments
  for each row execute function public.job_assignments_z_external();

create or replace function public.job_openings_z_external_credit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ten uuid;
begin
  if new.sourcer_user_id is null and new.recruiter_user_id is null then
    return new;
  end if;
  select j.tenant_id into ten from public.jobs j where j.id = new.job_id;
  if public.os_is_external(ten, new.sourcer_user_id) or public.os_is_external(ten, new.recruiter_user_id) then
    raise exception 'People outside Virgilio can''t be credited as Sourcer or Recruiter on a hire.' using errcode = 'GEX03';
  end if;
  return new;
end;
$function$;
create or replace trigger job_openings_z_external_credit before insert or update of sourcer_user_id, recruiter_user_id on public.job_openings
  for each row execute function public.job_openings_z_external_credit();

-- 5. Nothing internal reaches them, and they aren't counted.
create or replace function public.os_active_people(_tenant_id uuid)
 returns table(user_id uuid, member_id uuid, name text, avatar_url text, country_code text, birth_date date, start_date date, max_open_jobs integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select m.user_id, m.id,
    coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.email, m.invited_email),
    p.avatar_url, d.country_code, d.birth_date, w.start_date, w.max_open_jobs
  from public.members m
  left join public.profiles p on p.user_id = m.user_id
  left join public.os_person_details d on d.tenant_id = m.tenant_id and d.user_id = m.user_id
  left join public.os_person_work w on w.tenant_id = m.tenant_id and w.user_id = m.user_id
  where m.tenant_id = _tenant_id and m.user_status = 'active' and m.user_id is not null
    and m.user_type::text <> 'external';
$function$;

create or replace function public.os_team_calendar(_tenant_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  today date := public.os_today();
  mine text;
begin
  if auth.uid() is null or not exists (
      select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = auth.uid() and m.user_status = 'active'
        and m.user_type::text <> 'external') then
    raise exception 'Only members of this workspace see its calendar.' using errcode = 'GPD01';
  end if;
  select d.country_code into mine from public.os_person_details d where d.tenant_id = _tenant_id and d.user_id = auth.uid();
  return jsonb_build_object(
    'today', today,
    'country_code', mine,
    'birthdays', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'name', x.name, 'avatar_url', x.avatar_url,
        'date', x.next, 'mine', x.user_id = auth.uid()) order by x.next, x.name)
      from (select a.*, public.os_next_occurrence(a.birth_date, today) as next
            from public.os_active_people(_tenant_id) a where a.birth_date is not null) x
      where x.next <= today + 30), '[]'::jsonb),
    'holidays', public.os_holidays_between(_tenant_id, today, 60, case when mine is null then '{}'::text[] else array[mine] end));
end;
$function$;

alter policy os_useful_links_read on public.os_useful_links
  using (public.is_os_admin(tenant_id)
    or (archived_at is null and public.user_has_active_tenant_membership(tenant_id)
        and not public.os_is_external(tenant_id, auth.uid())));

-- People & Access lists Virgilio people only; anyone still reads their own row.
create or replace function public.os_people(_tenant_id uuid)
 returns table(member_id uuid, user_id uuid, email text, first_name text, last_name text, avatar_url text, member_status text, system_role text, user_type text, last_sign_in_at timestamp with time zone, profile_status text, bundle_id uuid, google_email text, google_status text, active_jobs integer, closed_jobs integer, grants jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  -- Admins see everyone at Virgilio (externals are managed in Settings, Members), anyone else only themself.
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
    and ((public.is_os_admin(_tenant_id) and m.user_type::text <> 'external')
      or (m.user_id = auth.uid() and auth.uid() is not null));
end;
$function$;

-- The dashboard counts Virgilio people only (os_active_people already leaves externals out).
create or replace function public.os_people_dashboard(_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  today date := public.os_today();
  out jsonb;
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only People & Access admins see the dashboard.' using errcode = 'GPD01';
  end if;
  with people as (
    select a.*,
      (select count(distinct ja.job_id) from public.job_assignments ja join public.jobs j on j.id = ja.job_id
        where ja.user_id = a.user_id and ja.deleted_at is null and j.tenant_id = _tenant_id and j.status = 'open') as open_jobs,
      exists (select 1 from public.os_person_tax_ids t where t.tenant_id = _tenant_id and t.user_id = a.user_id and t.removed_at is null) as has_tax,
      exists (select 1 from public.os_person_bank b where b.tenant_id = _tenant_id and b.user_id = a.user_id) as has_bank
    from public.os_active_people(_tenant_id) a
  ), marked as (
    select p.*,
      array_remove(array[
        case when p.country_code is null then 'country' end,
        case when not p.has_tax then 'tax_id' end,
        case when not p.has_bank then 'bank' end,
        case when p.birth_date is null then 'birthday' end], null) as missing,
      case when p.max_open_jobs is null then 'unset'
           when p.open_jobs > p.max_open_jobs then 'over'
           when p.open_jobs >= ceil(p.max_open_jobs * 0.8) then 'near'
           else 'ok' end as load
    from people p
  )
  select jsonb_build_object(
    'today', today,
    'active', (select count(*) from marked),
    'invited', (select count(*) from public.members m where m.tenant_id = _tenant_id and m.user_status = 'invited'
      and m.user_type::text <> 'external'),
    'complete', (select count(*) from marked where country_code is not null and has_tax and has_bank),
    'near_capacity', (select count(*) from marked where load = 'near'),
    'over_capacity', (select count(*) from marked where load = 'over'),
    'birthdays', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'member_id', x.member_id, 'name', x.name,
        'avatar_url', x.avatar_url, 'date', x.next) order by x.next, x.name)
      from (select m.*, public.os_next_occurrence(m.birth_date, today) as next from marked m where m.birth_date is not null) x
      where x.next <= today + 30), '[]'::jsonb),
    'anniversaries', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'member_id', x.member_id, 'name', x.name,
        'avatar_url', x.avatar_url, 'date', x.next, 'years', extract(year from x.next)::int - extract(year from x.start_date)::int)
        order by x.next, x.name)
      from (select m.*, public.os_next_occurrence(m.start_date, today) as next from marked m where m.start_date is not null) x
      where x.next <= today + 30 and extract(year from x.next) > extract(year from x.start_date)), '[]'::jsonb),
    'holidays', public.os_holidays_between(_tenant_id, today, 60,
      coalesce((select array_agg(distinct country_code) from marked where country_code is not null), '{}')),
    'by_country', coalesce((select jsonb_agg(jsonb_build_object('country_code', c.country_code, 'people', c.n) order by c.n desc, c.country_code nulls last)
      from (select country_code, count(*) as n from marked group by country_code) c), '[]'::jsonb),
    'missing', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'member_id', m.member_id, 'name', m.name,
        'avatar_url', m.avatar_url, 'missing', to_jsonb(m.missing)) order by cardinality(m.missing) desc, m.name)
      from marked m where cardinality(m.missing) > 0), '[]'::jsonb),
    'load', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'member_id', m.member_id, 'name', m.name,
        'avatar_url', m.avatar_url, 'open_jobs', m.open_jobs, 'max_open_jobs', m.max_open_jobs, 'load', m.load)
        order by (m.open_jobs::numeric / nullif(m.max_open_jobs, 0)) desc nulls last, m.open_jobs desc)
      from marked m where m.load in ('near', 'over')), '[]'::jsonb)
  ) into out from (select 1) one;
  return out;
end;
$function$;
