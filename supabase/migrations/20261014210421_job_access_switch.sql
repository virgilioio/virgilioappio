-- Job-based access, Part C1 (design doc "Gio OS: People & Access", 2026-10-14).
--
-- Today four helpers say yes to every active member, and most security rules
-- in the ATS use one of them. This migration teaches them a per-workspace
-- switch, tenants.settings->>'job_based_access'. While the switch is off
-- (the default, and how this ships) nothing changes. When it is on:
--   * admins, workspace owners and platform admins keep everything;
--   * a TA (recruiter) or Sourcer on a draft or open job gets the whole
--     talent pool and the workspace-wide screens, as before;
--   * everyone else (hiring managers, interviewers, people on closed jobs
--     only, people on no job) loses the workspace-wide paths and keeps only
--     what is tied to their own jobs: the rules that already allow "assigned
--     to this job", plus the job-team rules added below.
-- Assignments that were removed (deleted_at) stop counting everywhere.

-- ---------------------------------------------------------------------------
-- The switch and the two questions every rule asks
-- ---------------------------------------------------------------------------
create or replace function public.job_access_enforced(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select (t.settings->>'job_based_access')::boolean from public.tenants t where t.id = _tenant_id), false);
$function$;

-- Admin-level: platform admin, workspace owner, or an active admin of the workspace.
create or replace function public.is_ats_admin(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid() and m.user_status = 'active'
      and (
        m.user_type = 'platform_admin'
        or (m.tenant_id = _tenant_id and (m.user_type = 'workspace_owner' or m.system_role = 'admin'))
      )
  );
$function$;

-- A TA or Sourcer seat on a draft or open job in the workspace.
create or replace function public.has_talent_pool_seat(_tenant_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    where ja.user_id = _user_id
      and ja.deleted_at is null
      and ja.role in ('recruiter', 'sourcer')
      and j.status in ('draft', 'open')
      and j.tenant_id = _tenant_id
  );
$function$;

-- What the old member-wide checks mean once the switch is on.
create or replace function public.has_workspace_wide_access(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select not public.job_access_enforced(_tenant_id)
    or public.is_ats_admin(_tenant_id)
    or public.has_talent_pool_seat(_tenant_id);
$function$;

-- Anyone on this job's team (closed jobs included, read-only enforced by the
-- write rules), or an admin.
create or replace function public.can_see_job(_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.jobs j
    where j.id = _job_id
      and (
        public.is_ats_admin(j.tenant_id)
        or exists (
          select 1 from public.job_assignments ja
          where ja.job_id = j.id and ja.user_id = auth.uid() and ja.deleted_at is null
        )
      )
  );
$function$;

-- The jobs I'm on, worked out once per query when used as `in (select my_job_ids())`.
create or replace function public.my_job_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select ja.job_id from public.job_assignments ja
  where ja.user_id = auth.uid() and ja.deleted_at is null;
$function$;
revoke execute on function public.my_job_ids() from public, anon;
grant execute on function public.my_job_ids() to authenticated, service_role;

revoke execute on function public.job_access_enforced(uuid) from public, anon;
revoke execute on function public.is_ats_admin(uuid) from public, anon;
revoke execute on function public.has_talent_pool_seat(uuid, uuid) from public, anon;
revoke execute on function public.has_workspace_wide_access(uuid) from public, anon;
revoke execute on function public.can_see_job(uuid) from public, anon;
grant execute on function public.job_access_enforced(uuid) to authenticated, service_role;
grant execute on function public.is_ats_admin(uuid) to authenticated, service_role;
grant execute on function public.has_talent_pool_seat(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_workspace_wide_access(uuid) to authenticated, service_role;
grant execute on function public.can_see_job(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The four member-wide helpers learn the switch (bodies otherwise unchanged).
-- The check is written inline in the three SQL helpers: they run once per
-- row in most rules, and a nested function call per row costs too much.
-- ---------------------------------------------------------------------------
create or replace function public.user_has_tenant_access(check_tenant_id uuid)
returns boolean
language sql
stable
security definer
as $function$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid() and m.tenant_id = check_tenant_id
      and m.user_status = 'active'
  ) and (not coalesce((select (tt.settings->>'job_based_access')::boolean from public.tenants tt where tt.id = check_tenant_id), false) or exists (select 1 from public.members ma where ma.user_id = auth.uid() and ma.user_status = 'active' and (ma.user_type = 'platform_admin' or (ma.tenant_id = check_tenant_id and (ma.user_type = 'workspace_owner' or ma.system_role = 'admin')))) or exists (select 1 from public.job_assignments jx join public.jobs jj on jj.id = jx.job_id where jx.user_id = auth.uid() and jx.deleted_at is null and jx.role in ('recruiter', 'sourcer') and jj.status in ('draft', 'open') and jj.tenant_id = check_tenant_id));
$function$;

create or replace function public.check_org_hierarchy_role_access(_organization_id uuid, _required_role text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.members m
    join public.organizations o on m.tenant_id = o.tenant_id
    where o.id = _organization_id
      and m.user_id = auth.uid()
      and m.user_status = 'active'
      and (
        m.user_type in ('workspace_owner', 'platform_admin')
        or (
          case when _required_role = 'admin'
            then m.system_role = 'admin'
            else m.system_role in ('admin', 'member') and (not coalesce((select (tt.settings->>'job_based_access')::boolean from public.tenants tt where tt.id = o.tenant_id), false) or exists (select 1 from public.members ma where ma.user_id = auth.uid() and ma.user_status = 'active' and (ma.user_type = 'platform_admin' or (ma.tenant_id = o.tenant_id and (ma.user_type = 'workspace_owner' or ma.system_role = 'admin')))) or exists (select 1 from public.job_assignments jx join public.jobs jj on jj.id = jx.job_id where jx.user_id = auth.uid() and jx.deleted_at is null and jx.role in ('recruiter', 'sourcer') and jj.status in ('draft', 'open') and jj.tenant_id = o.tenant_id))
          end
        )
      )
  )
$function$;

create or replace function public.check_tenant_member_role(tenant_id_param uuid, required_role text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if exists (
    select 1 from public.members
    where user_id = auth.uid() and user_type = 'platform_admin' and user_status = 'active'
  ) then
    return true;
  end if;

  if required_role = 'recruiter' then
    return exists (
      select 1 from public.members m
      where m.user_id = auth.uid() and m.tenant_id = tenant_id_param and m.user_status = 'active'
        and (m.user_type = 'workspace_owner' or m.system_role in ('admin', 'member'))
    ) and (not coalesce((select (tt.settings->>'job_based_access')::boolean from public.tenants tt where tt.id = tenant_id_param), false) or exists (select 1 from public.members ma where ma.user_id = auth.uid() and ma.user_status = 'active' and (ma.user_type = 'platform_admin' or (ma.tenant_id = tenant_id_param and (ma.user_type = 'workspace_owner' or ma.system_role = 'admin')))) or exists (select 1 from public.job_assignments jx join public.jobs jj on jj.id = jx.job_id where jx.user_id = auth.uid() and jx.deleted_at is null and jx.role in ('recruiter', 'sourcer') and jj.status in ('draft', 'open') and jj.tenant_id = tenant_id_param));
  else
    return exists (
      select 1 from public.members m
      where m.user_id = auth.uid() and m.tenant_id = tenant_id_param and m.user_status = 'active'
        and (m.user_type = 'workspace_owner' or m.system_role = 'admin')
    );
  end if;
end;
$function$;

create or replace function public.user_has_org_hierarchy_access(target_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid;
  member_org_id uuid;
  org_tree_ids uuid[];
  target_tenant uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return false;
  end if;

  set local row_security = off;

  -- Job-based access: outside admins and TA/Sourcer seats, the org tree no
  -- longer grants anything.
  select o.tenant_id into target_tenant from public.organizations o where o.id = target_org_id;
  if target_tenant is not null and not (not coalesce((select (tt.settings->>'job_based_access')::boolean from public.tenants tt where tt.id = target_tenant), false) or exists (select 1 from public.members ma where ma.user_id = auth.uid() and ma.user_status = 'active' and (ma.user_type = 'platform_admin' or (ma.tenant_id = target_tenant and (ma.user_type = 'workspace_owner' or ma.system_role = 'admin')))) or exists (select 1 from public.job_assignments jx join public.jobs jj on jj.id = jx.job_id where jx.user_id = auth.uid() and jx.deleted_at is null and jx.role in ('recruiter', 'sourcer') and jj.status in ('draft', 'open') and jj.tenant_id = target_tenant)) then
    set local row_security = on;
    return false;
  end if;

  for member_org_id in
    select organization_id
    from public.members
    where user_id = current_user_id
      and user_status = 'active'
  loop
    select array_agg(id) into org_tree_ids
    from (
      select member_org_id as id
      union
      select parent_organization_id as id
      from public.organizations
      where id = member_org_id
        and parent_organization_id is not null
      union
      select o.id
      from public.organizations o
      where o.parent_organization_id = (
        select parent_organization_id
        from public.organizations
        where id = member_org_id
      )
      and o.parent_organization_id is not null
      union
      select o.id
      from public.organizations o
      where o.parent_organization_id = member_org_id
    ) tree;

    if target_org_id = any(org_tree_ids) then
      set local row_security = on;
      return true;
    end if;
  end loop;

  set local row_security = on;
  return false;
end;
$function$;

-- Removed assignments stop counting (0 such rows today).
create or replace function public.is_user_assigned_to_job(job_id_param uuid, user_id_param uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.job_assignments ja
    where ja.job_id = job_id_param
      and ja.user_id = user_id_param
      and ja.deleted_at is null
  );
$function$;

-- ---------------------------------------------------------------------------
-- Every member still reads the workspace record and its departments
-- (the app shell and job headers need them; neither holds candidate data).
-- ---------------------------------------------------------------------------
create or replace function public.is_active_member(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid() and m.tenant_id = _tenant_id and m.user_status = 'active'
  );
$function$;
revoke execute on function public.is_active_member(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated, service_role;

alter policy tenants_users_select_own on public.tenants
  using (public.is_active_member(id));

alter policy "Departments are readable by tenant members" on public.departments
  using (public.is_active_member(tenant_id));

-- ---------------------------------------------------------------------------
-- Rules that granted every member directly (not through the helpers above)
-- now ask for workspace-wide access, or the job where it applies.
-- ---------------------------------------------------------------------------
alter policy "Users can view comments for accessible candidates" on public.candidate_comments
  using (
    exists (
      select 1 from public.members m
      where m.user_id = (select auth.uid())
        and m.organization_id = candidate_comments.organization_id
        and m.user_status = 'active'
        and m.system_role = any (array['admin'::public.system_role, 'member'::public.system_role])
    )
    and (
      public.has_workspace_wide_access((select o.tenant_id from public.organizations o where o.id = candidate_comments.organization_id))
      or candidate_comments.job_id in (select public.my_job_ids())
    )
  );

alter policy "Organization members can view offer letters in their org" on public.offer_letters
  using (
    exists (
      select 1 from public.members m
      where m.user_id = (select auth.uid())
        and m.organization_id = offer_letters.organization_id
        and m.user_status = 'active'
    )
    and public.has_workspace_wide_access((select o.tenant_id from public.organizations o where o.id = offer_letters.organization_id))
  );

alter policy reference_requests_select on public.reference_requests
  using (
    public.get_user_type_secure() = 'platform_admin'
    or (tenant_id = public.get_user_tenant_id() and public.has_workspace_wide_access(tenant_id))
  );

alter policy scheduled_bookings_select on public.scheduled_bookings
  using (
    (tenant_id = public.get_user_tenant_id() and public.has_workspace_wide_access(tenant_id))
    or interviewer_id = (select auth.uid())
    or job_id in (select public.my_job_ids())
  );

alter policy scheduled_bookings_select_tenant on public.scheduled_bookings
  using (
    (
      tenant_id in (
        select members.tenant_id from public.members
        where members.user_id = (select auth.uid()) and members.user_status = 'active'
      )
      and public.has_workspace_wide_access(tenant_id)
    )
    or interviewer_id = (select auth.uid())
  );

alter policy "Users can manage scheduled emails in their tenant" on public.scheduled_emails
  using (
    exists (
      select 1 from public.members m
      where m.user_id = (select auth.uid())
        and m.tenant_id = scheduled_emails.tenant_id
        and m.user_status = 'active'
    )
    and public.has_workspace_wide_access(tenant_id)
  );

-- ---------------------------------------------------------------------------
-- A job's team reads what its pipeline shows (added rules; they only add
-- access, and only to the job's own candidates). "My jobs" is worked out once
-- per query (an uncorrelated subquery), not once per row.
-- ---------------------------------------------------------------------------

create policy job_team_reads_scorecard_responses on public.scorecard_question_responses
  for select to authenticated
  using (scorecard_id in (
    select s.id from public.job_stage_scorecards s where s.job_id in (select public.my_job_ids())
  ));

create policy job_team_reads_stage_events on public.stage_events
  for select to authenticated
  using (job_id in (select public.my_job_ids()));

create policy job_team_reads_application_responses on public.candidate_application_responses
  for select to authenticated
  using (job_id in (select public.my_job_ids()));

create policy job_team_reads_work_experience on public.candidate_work_experience
  for select to authenticated
  using (candidate_id in (
    select a.candidate_id from public.job_candidate_associations a where a.job_id in (select public.my_job_ids())
  ));

create policy job_team_reads_education on public.candidate_education
  for select to authenticated
  using (candidate_id in (
    select a.candidate_id from public.job_candidate_associations a where a.job_id in (select public.my_job_ids())
  ));

create policy job_team_reads_certifications on public.candidate_certifications
  for select to authenticated
  using (candidate_id in (
    select a.candidate_id from public.job_candidate_associations a where a.job_id in (select public.my_job_ids())
  ));
