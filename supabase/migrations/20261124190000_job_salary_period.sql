-- A job's salary range is per its own pay period (Allan, Go! 2026-11-24). 112 jobs
-- had a range and no period; Gio Fit read every one as yearly, so a monthly MXN
-- range (MXN 25,000-40,000) made a monthly expectation look 12x off and salary
-- was left out of the candidate's dossier. Gio Fit now reads the job's own
-- period (bandPeriodOf in supabase/functions/_shared/salary.ts); this fills in
-- the period those jobs never had, by the same rule: a range whose top is under
-- about USD 15,000 (at the workspace's latest rate, else a rough one) is monthly,
-- anything else yearly.
--
-- 1. The rule, kept in step with bandPeriodOf.
create or replace function public.job_band_period_guess(p_job uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  with j as (
    select id, tenant_id, upper(coalesce(currency, 'USD')) cur,
           coalesce(salary_max, salary_min)::numeric top
      from public.jobs where id = p_job
  ),
  r as (
    select coalesce(
      case when j.cur = 'USD' then 1 end,
      (select c.rate from public.currency_rates c
        where c.base_currency = j.cur and c.quote_currency = 'USD'
          and (c.tenant_id = j.tenant_id or c.tenant_id is null)
        order by c.rate_date desc limit 1),
      (select 1 / c.rate from public.currency_rates c
        where c.base_currency = 'USD' and c.quote_currency = j.cur and c.rate > 0
          and (c.tenant_id = j.tenant_id or c.tenant_id is null)
        order by c.rate_date desc limit 1),
      case j.cur
        when 'EUR' then 1.08 when 'GBP' then 1.27 when 'CAD' then 0.73 when 'AUD' then 0.66
        when 'CHF' then 1.13 when 'MXN' then 0.055 when 'COP' then 0.00025 when 'BRL' then 0.18
        when 'CLP' then 0.0011 when 'PEN' then 0.27 when 'ARS' then 0.001 when 'INR' then 0.012
        when 'PHP' then 0.017 end
    ) usd_per_unit
    from j
  )
  select case
    when j.top is null or j.top <= 0 or r.usd_per_unit is null then null
    when j.top * r.usd_per_unit < 15000 then 'monthly'
    else 'annual'
  end
  from j, r
$function$;

revoke all on function public.job_band_period_guess(uuid) from public, anon, authenticated;

-- 2. A change of pay period is a change Gio Fit reads: it re-scores like a
-- change of range. The rest of this function is unchanged.
create or replace function public.fit_queue_on_job_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  queued int;
begin
  -- Formatting alone, or nothing Gio Fit reads, changed.
  if public.fit_job_text(new.description) = public.fit_job_text(old.description)
     and new.skills is not distinct from old.skills
     and new.skill_priorities is not distinct from old.skill_priorities
     and new.min_years_experience is not distinct from old.min_years_experience
     and new.max_years_experience is not distinct from old.max_years_experience
     and new.salary_min is not distinct from old.salary_min
     and new.salary_max is not distinct from old.salary_max
     and new.salary_period is not distinct from old.salary_period
     and new.currency is not distinct from old.currency
     and new.budget_salary_min is not distinct from old.budget_salary_min
     and new.budget_salary_max is not distinct from old.budget_salary_max
     and new.budget_period is not distinct from old.budget_period
     and new.budget_currency is not distinct from old.budget_currency
     and new.location is not distinct from old.location
     and new.additional_locations is not distinct from old.additional_locations then
    return new;
  end if;
  -- Scoring is off for this job, or there's no description to score against yet.
  if not coalesce((select s.auto_score from job_settings s where s.job_id = new.id), true)
     or length(public.fit_job_text(new.description)) < 30 then
    return new;
  end if;

  insert into fit_analysis_queue (association_id, reason, priority, status, attempts, next_attempt_at, last_error)
  select a.id, 'rescore', 2, 'pending', 0, now() + interval '10 minutes', null
    from job_candidate_associations a
   where a.job_id = new.id
     and a.ai_fit_analysis is not null
     and lower(coalesce(a.status, '')) in ('active', 'new')
  on conflict (association_id) do update
     set status = 'pending', reason = 'rescore', priority = 2, attempts = 0, last_error = null,
         next_attempt_at = now() + interval '10 minutes', updated_at = now()
   -- A re-score or first score already due goes ahead as it is; it reads the job when it runs.
   where fit_analysis_queue.status in ('done', 'failed')
      or (fit_analysis_queue.status = 'pending' and fit_analysis_queue.priority = 2);
  get diagnostics queued = row_count;
  return new;
exception when others then
  raise warning 'fit_queue_on_job_change failed: % %', sqlerrm, sqlstate;
  return new;
end;
$function$;

-- 3. Fill in the period on jobs with a range and none. Not an edit: the table's
-- own triggers stay out of it (no re-score of every closed job, no history,
-- no Slack), and the dossiers that left salary out are queued below instead.
alter table public.jobs disable trigger user;

update public.jobs j
   set salary_period = public.job_band_period_guess(j.id)
 where j.salary_period is null
   and (j.salary_min is not null or j.salary_max is not null)
   and public.job_band_period_guess(j.id) is not null;

alter table public.jobs enable trigger user;

-- 4. Re-score the dossiers that left salary out although the candidate has an
-- expectation and the job a range (candidates still in the process, as
-- fit_queue_rescore does). Runs after analyze-candidate-fit v6 is deployed.
insert into public.fit_analysis_queue (association_id, reason, priority, status, attempts, next_attempt_at, last_error)
select a.id, 'rescore', 1, 'pending', 0, now(), null
  from public.job_candidate_associations a
  join public.candidates c on c.id = a.candidate_id
  join public.jobs j on j.id = a.job_id
 where a.ai_fit_analysis is not null
   and c.salary_amount > 0
   and (j.salary_min is not null or j.salary_max is not null)
   and lower(coalesce(a.status, '')) not in ('rejected', 'withdrawn')
   and exists (
     select 1 from jsonb_array_elements(coalesce(a.ai_fit_analysis -> 'dimensions', '[]'::jsonb)) d
      where d ->> 'name' ilike '%salary%' and d ->> 'score' is null
   )
on conflict (association_id) do update
   set status = 'pending', reason = 'rescore', priority = least(public.fit_analysis_queue.priority, 1),
       attempts = 0, last_error = null, next_attempt_at = now(), updated_at = now();

select public.fit_queue_wake();
