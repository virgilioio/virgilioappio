-- "Not a fit" on suggested candidates (2026-10-13).
-- Dismissals lived in the browser, so they only stuck on the computer where
-- someone clicked them and came back for everyone else. They now live here, one
-- row per job and candidate, shared by everyone who can see the job. Undo sets
-- undone_at instead of removing the row, and dismissing again clears it. The
-- suggestion engine leaves out candidates with an active dismissal.
--
-- No foreign keys on purpose: a dismissal is only a filter, and a key without a
-- cascade would block removing a job or a candidate. Rows whose job or
-- candidate is gone match nothing and are invisible through the policies.

create table public.job_suggestion_dismissals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  candidate_id uuid not null,
  dismissed_by uuid default auth.uid(),
  dismissed_at timestamptz not null default now(),
  undone_at timestamptz,
  constraint job_suggestion_dismissals_job_candidate_key unique (job_id, candidate_id)
);

create index job_suggestion_dismissals_active_idx
  on public.job_suggestion_dismissals (job_id)
  where undone_at is null;

alter table public.job_suggestion_dismissals enable row level security;

-- Same reach as the job's pipeline (job_candidate_associations).
create function public.can_access_job_pipeline(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_user_type_secure() = 'platform_admin'
    or public.is_user_assigned_to_job(p_job_id)
    or coalesce(public.user_has_org_hierarchy_access(
         (select j.organization_id from public.jobs j where j.id = p_job_id)), false)
$$;

revoke all on function public.can_access_job_pipeline(uuid) from public, anon;
grant execute on function public.can_access_job_pipeline(uuid) to authenticated;

create policy "Read dismissals for accessible jobs"
  on public.job_suggestion_dismissals for select to authenticated
  using (public.can_access_job_pipeline(job_id));

create policy "Add dismissals for accessible jobs"
  on public.job_suggestion_dismissals for insert to authenticated
  with check (dismissed_by = auth.uid() and public.can_access_job_pipeline(job_id));

-- Dismiss again (clears undone_at) or Undo (sets it).
create policy "Change dismissals for accessible jobs"
  on public.job_suggestion_dismissals for update to authenticated
  using (public.can_access_job_pipeline(job_id))
  with check (public.can_access_job_pipeline(job_id));

grant select, insert, update on public.job_suggestion_dismissals to authenticated;
