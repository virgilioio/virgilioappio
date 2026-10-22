-- Who sees candidates (Allan, 2026-10-22).
--
-- The talent pool (Find, every job, Candidates, any candidate's page) is for
-- active members who are platform admins, admins (workspace owners count as
-- admins), or a recruiter or sourcer on a draft or open job. Hiring managers
-- and interviewers see the jobs they are on and those jobs' candidates.
-- Everyone else, deactivated people included, sees no candidates.
--
-- Before this, a seat counted even after its holder was deactivated (Zara kept
-- 6 jobs and 151 candidates), and the talent-pool check depended on a
-- per-workspace switch. Now:
-- 1. a seat counts only while its holder is an active member of the job's
--    workspace (is_user_assigned_to_job, my_job_ids, can_see_job,
--    has_talent_pool_seat);
-- 2. the talent-pool check (wwa_memo, user_can_see_candidate) is the same in
--    every workspace; the switch is set on everywhere so the Edge Functions,
--    which still read it, agree;
-- 3. the policies that read job_assignments themselves go through the helper;
-- 4. an inactive author no longer reads their old scorecards, and team
--    reminders follow the candidate's visibility.

-- 1. Seats --------------------------------------------------------------------------------

create or replace function public.is_user_assigned_to_job(job_id_param uuid, user_id_param uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    join public.members m on m.user_id = ja.user_id and m.tenant_id = j.tenant_id and m.user_status = 'active'
    where ja.job_id = job_id_param
      and ja.user_id = user_id_param
      and ja.deleted_at is null
  );
$function$;

create or replace function public.my_job_ids()
returns setof uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select ja.job_id
  from public.job_assignments ja
  join public.jobs j on j.id = ja.job_id
  join public.members m on m.user_id = ja.user_id and m.tenant_id = j.tenant_id and m.user_status = 'active'
  where ja.user_id = auth.uid() and ja.deleted_at is null;
$function$;

create or replace function public.can_see_job(_job_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.jobs j
    where j.id = _job_id
      and (public.is_ats_admin(j.tenant_id) or public.is_user_assigned_to_job(j.id))
  );
$function$;

create or replace function public.has_talent_pool_seat(_tenant_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    join public.members m on m.user_id = ja.user_id and m.tenant_id = j.tenant_id and m.user_status = 'active'
    where ja.user_id = _user_id
      and ja.deleted_at is null
      and ja.role in ('recruiter', 'sourcer')
      and j.status in ('draft', 'open')
      and j.tenant_id = _tenant_id
  );
$function$;

-- 2. The talent pool ----------------------------------------------------------------------

create or replace function public.wwa_memo(_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  k text;
  v text;
  me text := coalesce(auth.uid()::text, '');
  r boolean;
begin
  if _tenant_id is null then
    return false;
  end if;
  k := 'gio.wwa_' || replace(_tenant_id::text, '-', '');
  v := current_setting(k, true);
  if v is not null and v <> '' and split_part(v, '|', 1) = me then
    return split_part(v, '|', 2) = 't';
  end if;
  r := exists (
         select 1 from public.members ma
         where ma.user_id = auth.uid() and ma.user_status = 'active'
           and (ma.user_type = 'platform_admin' or (ma.tenant_id = _tenant_id and (ma.user_type = 'workspace_owner' or ma.system_role = 'admin')))
       )
       or public.has_talent_pool_seat(_tenant_id, auth.uid());
  perform set_config(k, me || '|' || case when r then 't' else 'f' end, true);
  return r;
end;
$function$;

create or replace function public.user_can_see_candidate(_user_id uuid, _candidate_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.candidates c
    where c.id = _candidate_id and c.deleted_at is null
      and (
        exists (select 1 from public.members m
                where m.user_id = _user_id and m.user_status = 'active' and m.user_type = 'platform_admin')
        or exists (select 1 from public.members ma
                   where ma.user_id = _user_id and ma.user_status = 'active' and ma.tenant_id = c.tenant_id
                     and (ma.user_type = 'workspace_owner' or ma.system_role = 'admin'))
        or public.has_talent_pool_seat(c.tenant_id, _user_id)
        or exists (select 1 from public.job_candidate_associations jca
                   where jca.candidate_id = c.id and public.is_user_assigned_to_job(jca.job_id, _user_id))
      )
  );
$function$;

-- The Edge Functions (_shared/caller.ts) still read this switch; on everywhere,
-- they apply the same rule as the database.
update public.tenants
set settings = coalesce(settings, '{}'::jsonb) || '{"job_based_access": true}'::jsonb
where coalesce((settings->>'job_based_access')::boolean, false) = false;

alter table public.tenants alter column settings set default '{"job_based_access": true}'::jsonb;

-- 3. Policies that read seats themselves --------------------------------------------------

alter policy "View associations - org member or assigned" on public.job_candidate_associations
  using (
    (exists (select 1 from public.jobs j join public.members m on j.organization_id = m.organization_id
             where j.id = job_candidate_associations.job_id and m.user_id = (select auth.uid()) and m.user_status = 'active'))
    or public.is_user_assigned_to_job(job_id)
  );

alter policy "Members and job-assigned users can view stage history" on public.job_candidate_stage_history
  using (
    (exists (select 1 from public.job_candidate_associations jca
             join public.jobs j on jca.job_id = j.id
             join public.members m on m.organization_id = j.organization_id
             where jca.id = job_candidate_stage_history.association_id and m.user_id = (select auth.uid()) and m.user_status = 'active'))
    or (exists (select 1 from public.job_candidate_associations jca
                where jca.id = job_candidate_stage_history.association_id and public.is_user_assigned_to_job(jca.job_id)))
    or (public.get_user_type_secure() = 'platform_admin')
  );

alter policy "Users can view accessible scorecards" on public.job_stage_scorecards
  using (
    (created_by = (select auth.uid()) and public.get_user_tenant_id() is not null)
    or (public.get_user_type_secure() = 'platform_admin')
    or (exists (select 1 from public.members m join public.jobs j on j.organization_id = m.organization_id
                where j.id = job_stage_scorecards.job_id and m.user_id = (select auth.uid()) and m.user_status = 'active'))
    or public.is_user_assigned_to_job(job_id)
  );

alter policy "Users can create scorecards for accessible jobs" on public.job_stage_scorecards
  with check (
    created_by = (select auth.uid())
    and (
      (public.get_user_type_secure() = 'platform_admin')
      or (exists (select 1 from public.members m
                  join public.job_candidate_associations jca on jca.id = job_stage_scorecards.association_id
                  join public.jobs j on j.id = jca.job_id
                  where m.user_id = (select auth.uid()) and m.organization_id = j.organization_id and m.user_status = 'active'))
      or (exists (select 1 from public.job_candidate_associations jca
                  where jca.id = job_stage_scorecards.association_id and public.is_user_assigned_to_job(jca.job_id)))
    )
  );

alter policy "Users can view offer letters for jobs they are assigned to" on public.offer_letters
  using (public.is_user_assigned_to_job(job_id));

alter policy organizations_select_consolidated on public.organizations
  using (
    ((exists (select 1 from public.members m
              where m.user_id = (select auth.uid()) and m.user_status = 'active' and m.user_type = 'platform_admin'))
      and id in (select public.get_org_hierarchy(public.get_platform_tenant_id())))
    or public.user_is_member_of_org_hierarchy(id)
    or (exists (select 1 from public.jobs j
                where j.organization_id = organizations.id and j.id in (select public.my_job_ids())))
    or public.organization_has_active_public_posting(id)
  );

-- 4. Team reminders follow the candidate --------------------------------------------------

alter policy "Users can view team-visible reminders in their organization" on public.candidate_reminders
  using (
    is_team_visible = true
    and organization_id in (select members.organization_id from public.members
                            where members.user_id = (select auth.uid()) and members.user_status = 'active')
    and exists (select 1 from public.candidates c where c.id = candidate_reminders.candidate_id)
  );
