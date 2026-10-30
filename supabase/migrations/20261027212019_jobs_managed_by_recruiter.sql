-- A job is run by its Recruiter (Allan, 2026-10-27).
--
-- Admins and the job's Recruiter manage a job: its details, openings and
-- hiring plan, screening and notification settings, and the client view.
-- Until now the database let anyone with a seat on the job (interviewers and
-- hiring managers included) change those, any member of the workspace create
-- or change a job's client view link, and anyone with a Recruiter or Sourcer
-- seat on any open job (the talent-pool rule) change every job.
--
-- Now one rule, can_manage_job(job): admins (platform admins, workspace
-- owners, the workspace's admins) and the job's Recruiter. It is added as
-- restrictive policies, so the old rules stay and nothing is removed:
--   * jobs: changing a job also needs it, or a Sourcer seat on that job
--     (sourcers keep editing their own job's posting and details as today);
--   * job_openings: adding, changing, removing;
--   * the hiring plan: job_hiring_stages and stage_interviewer_assignments
--     (adding, changing, removing stages and who interviews in them);
--   * job_settings: changing (screening rules, Gio's AI screen, notifications);
--   * job_pipeline_shares: creating and changing the client view.
-- The hiring team keeps can_manage_job_team: admins add anyone, a job's
-- Recruiter or Sourcer adds hiring managers and interviewers; Recruiter and
-- Sourcer seats stay with admins.
--
-- mark_hired checks who may hire itself (anyone on the job, as before) and
-- now runs with its own rights, like unmark_hired and change_hire_credit, so
-- a hiring manager's hire still fills the opening and links the offer.

create or replace function public.can_manage_job(_job_id uuid)
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
        public.get_user_type_secure() = 'platform_admin'
        or exists (
          select 1 from public.members m
          where m.tenant_id = j.tenant_id
            and m.user_id = auth.uid()
            and m.user_status = 'active'
            and (m.user_type in ('workspace_owner', 'platform_admin') or m.system_role = 'admin'))
        or exists (
          select 1 from public.job_assignments ja
          join public.members m on m.user_id = ja.user_id and m.tenant_id = j.tenant_id and m.user_status = 'active'
          where ja.job_id = j.id
            and ja.user_id = auth.uid()
            and ja.deleted_at is null
            and ja.role = 'recruiter')
      ));
$function$;

revoke all on function public.can_manage_job(uuid) from public, anon;
grant execute on function public.can_manage_job(uuid) to authenticated;

-- A Sourcer seat on this job (for the job's own details and posting).
create or replace function public.is_job_sourcer(_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    join public.members m on m.user_id = ja.user_id and m.tenant_id = j.tenant_id and m.user_status = 'active'
    where ja.job_id = _job_id
      and ja.user_id = auth.uid()
      and ja.deleted_at is null
      and ja.role = 'sourcer');
$function$;

revoke all on function public.is_job_sourcer(uuid) from public, anon;
grant execute on function public.is_job_sourcer(uuid) to authenticated;

create policy "Only admins and the job's Recruiter or Sourcer change a job" on public.jobs
  as restrictive for update to authenticated
  using (public.can_manage_job(id) or public.is_job_sourcer(id))
  with check (public.can_manage_job(id) or public.is_job_sourcer(id));

create policy "Only admins and the job's Recruiter add openings" on public.job_openings
  as restrictive for insert to authenticated
  with check (public.can_manage_job(job_id));

create policy "Only admins and the job's Recruiter change openings" on public.job_openings
  as restrictive for update to authenticated
  using (public.can_manage_job(job_id))
  with check (public.can_manage_job(job_id));

create policy "Only admins and the job's Recruiter remove openings" on public.job_openings
  as restrictive for delete to authenticated
  using (public.can_manage_job(job_id));

create policy "Only admins and the job's Recruiter change job settings" on public.job_settings
  as restrictive for update to authenticated
  using (public.can_manage_job(job_id))
  with check (public.can_manage_job(job_id));

create policy "Only admins and the job's Recruiter create the client view" on public.job_pipeline_shares
  as restrictive for insert to authenticated
  with check (public.can_manage_job(job_id));

create policy "Only admins and the job's Recruiter change the client view" on public.job_pipeline_shares
  as restrictive for update to authenticated
  using (public.can_manage_job(job_id))
  with check (public.can_manage_job(job_id));

create policy "Only admins and the job's Recruiter add stages" on public.job_hiring_stages
  as restrictive for insert to authenticated
  with check (public.can_manage_job(job_id));

create policy "Only admins and the job's Recruiter change stages" on public.job_hiring_stages
  as restrictive for update to authenticated
  using (public.can_manage_job(job_id))
  with check (public.can_manage_job(job_id));

create policy "Only admins and the job's Recruiter remove stages" on public.job_hiring_stages
  as restrictive for delete to authenticated
  using (public.can_manage_job(job_id));

create or replace function public.can_manage_job_stage(_stage_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.job_hiring_stages s
    where s.id = _stage_id and public.can_manage_job(s.job_id));
$function$;

revoke all on function public.can_manage_job_stage(uuid) from public, anon;
grant execute on function public.can_manage_job_stage(uuid) to authenticated;

create policy "Only admins and the job's Recruiter add stage interviewers" on public.stage_interviewer_assignments
  as restrictive for insert to authenticated
  with check (public.can_manage_job_stage(job_hiring_stage_id));

create policy "Only admins and the job's Recruiter change stage interviewers" on public.stage_interviewer_assignments
  as restrictive for update to authenticated
  using (public.can_manage_job_stage(job_hiring_stage_id))
  with check (public.can_manage_job_stage(job_hiring_stage_id));

create policy "Only admins and the job's Recruiter remove stage interviewers" on public.stage_interviewer_assignments
  as restrictive for delete to authenticated
  using (public.can_manage_job_stage(job_hiring_stage_id));

alter function public.mark_hired(uuid, uuid, date, boolean, uuid, uuid) security definer;
