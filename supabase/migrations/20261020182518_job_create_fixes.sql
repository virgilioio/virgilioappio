-- Creating a job from the app has failed since 2026-10-04, and publishing a draft
-- that isn't ready showed a database error instead of what is missing.
--
-- 1. 20261004181526 let a person hold several roles on a job: job_assignments became
--    unique on (job_id, user_id, role). The trigger that puts a job's creator on its
--    team still said ON CONFLICT (job_id, user_id), which no longer matches any unique
--    key, so every insert into jobs by a signed-in member was refused (42P10).
-- 2. job_setup_checks built its list with `missing || 'Job info'`, which Postgres reads
--    as array || array and fails on ("malformed array literal") whenever anything is
--    missing. The publish gate and the job's setup checklist both call it.

create or replace function public.auto_assign_job_creator_to_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.members where user_id = auth.uid() and user_status = 'active') then
    insert into public.job_assignments (job_id, user_id, organization_id, assigned_by, role)
    values (new.id, auth.uid(), new.organization_id, auth.uid(), 'recruiter'::public.job_assignment_role)
    on conflict (job_id, user_id, role) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.job_setup_checks(p_job uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare j record; missing text[] := '{}';
  v_info bool; v_open bool; v_plan bool; v_team bool; v_attr bool;
begin
  select * into j from public.jobs where id = p_job;
  if j.id is null then return null; end if;
  v_info := coalesce(trim(j.title), '') <> '' and (j.department_id is not null or coalesce(trim(j.department), '') <> '');
  v_open := exists (select 1 from public.job_openings o where o.job_id = j.id and o.cancelled_at is null);
  v_plan := exists (select 1 from public.job_hiring_stages s where s.job_id = j.id);
  v_team := exists (select 1 from public.job_assignments a where a.job_id = j.id and a.deleted_at is null);
  if not v_info then missing := array_append(missing, 'Job info'); end if;
  if not v_open then missing := array_append(missing, 'Openings'); end if;
  if not v_plan then missing := array_append(missing, 'Hiring plan'); end if;
  if not v_team then missing := array_append(missing, 'Hiring team'); end if;
  if not exists (select 1 from public.job_assignments a where a.job_id = j.id and a.role = 'sourcer' and a.deleted_at is null) then
    missing := array_append(missing, 'Sourcing Partner');
  end if;
  if not exists (select 1 from public.job_assignments a where a.job_id = j.id and a.role = 'recruiter' and a.deleted_at is null) then
    missing := array_append(missing, 'TA Partner');
  end if;
  if j.sales_deal_id is not null then
    if jsonb_array_length(coalesce(j.sales_team -> 'sales', '[]'::jsonb)) = 0 then missing := array_append(missing, 'Sales'); end if;
    if jsonb_array_length(coalesce(j.sales_team -> 'es', '[]'::jsonb)) = 0 then missing := array_append(missing, 'Engagement Specialist'); end if;
  end if;
  v_attr := not (missing && array['Sourcing Partner', 'TA Partner', 'Sales', 'Engagement Specialist']::text[]);
  return jsonb_build_object('job_info', v_info, 'openings', v_open, 'hiring_plan', v_plan, 'hiring_team', v_team,
                            'attribution', v_attr, 'missing', to_jsonb(missing));
end;
$$;
