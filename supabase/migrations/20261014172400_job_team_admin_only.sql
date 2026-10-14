-- Job team changes (2026-10-14, design doc Part C step 2).
-- TA (recruiter) and Sourcer seats will grant the whole talent pool, so only
-- admins and platform admins may add, change or remove them. A TA or Sourcer
-- on a job may still add or remove that job's hiring managers and
-- interviewers, who only ever see the job's pipeline. Nobody else changes a
-- job team. Until now any active member could add anyone, themselves
-- included, to any job.

create or replace function public.can_manage_job_team(_job_id uuid, _role public.job_assignment_role)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    public.get_user_type_secure() = 'platform_admin'
    or exists (
      select 1
      from public.jobs j
      join public.members m on m.tenant_id = j.tenant_id
      where j.id = _job_id
        and m.user_id = auth.uid()
        and m.user_status = 'active'
        and m.system_role = 'admin'
    )
    or (
      _role in ('hiring_manager', 'interviewer')
      and exists (
        select 1
        from public.job_assignments ja
        join public.jobs j on j.id = ja.job_id
        join public.members m on m.tenant_id = j.tenant_id and m.user_id = ja.user_id
        where ja.job_id = _job_id
          and ja.user_id = auth.uid()
          and ja.deleted_at is null
          and ja.role in ('recruiter', 'sourcer')
          and m.user_status = 'active'
      )
    );
$function$;

revoke execute on function public.can_manage_job_team(uuid, public.job_assignment_role) from public, anon;
grant execute on function public.can_manage_job_team(uuid, public.job_assignment_role) to authenticated, service_role;

alter policy job_assignments_insert_consolidated on public.job_assignments
  with check (public.can_manage_job_team(job_id, role));

alter policy job_assignments_delete_consolidated on public.job_assignments
  using (public.can_manage_job_team(job_id, role));

-- Role changes had no policy, so only platform admins could make them.
-- Both the old and the new role must be one the caller may manage.
create policy job_assignments_update_team on public.job_assignments
  for update
  using (public.can_manage_job_team(job_id, role))
  with check (public.can_manage_job_team(job_id, role));
