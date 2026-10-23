-- The two hire roles are Sourcer and Recruiter everywhere (Allan, 2026-10-23),
-- not Sourcing Partner and TA Partner. Two functions still said the old names:
-- the one-seat-per-job message ("already on this job as TA Partner") and the
-- publish checks the job setup reads. Only the wording changes.

create or replace function public.job_seat_role_label(_role job_assignment_role)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case _role::text
    when 'recruiter' then 'Recruiter'
    when 'sourcer' then 'Sourcer'
    when 'hiring_manager' then 'Hiring manager'
    when 'interviewer' then 'Interviewer'
    else initcap(replace(_role::text, '_', ' '))
  end;
$function$;

create or replace function public.job_setup_checks(p_job uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
    missing := array_append(missing, 'Sourcer');
  end if;
  if not exists (select 1 from public.job_assignments a where a.job_id = j.id and a.role = 'recruiter' and a.deleted_at is null) then
    missing := array_append(missing, 'Recruiter');
  end if;
  if j.sales_deal_id is not null then
    if jsonb_array_length(coalesce(j.sales_team -> 'sales', '[]'::jsonb)) = 0 then missing := array_append(missing, 'Sales'); end if;
    if jsonb_array_length(coalesce(j.sales_team -> 'es', '[]'::jsonb)) = 0 then missing := array_append(missing, 'Engagement Specialist'); end if;
  end if;
  v_attr := not (missing && array['Sourcer', 'Recruiter', 'Sales', 'Engagement Specialist']::text[]);
  return jsonb_build_object('job_info', v_info, 'openings', v_open, 'hiring_plan', v_plan, 'hiring_team', v_team,
                            'attribution', v_attr, 'missing', to_jsonb(missing));
end;
$function$;
