-- Gio Fit re-scores (2026-11-07, Allan): a real change to what Gio Fit reads on a
-- job re-scores its candidates, and anyone who can edit a job can re-score a
-- selection by hand from the selection bar.
--
-- 1. fit_analysis_queue.priority: 0 a re-score someone asked for, 1 new candidates
--    and scorecards (the default), 2 a re-score after a job change. process-fit-queue
--    takes the lowest first, then whoever has waited longest, so a big job edit
--    never holds up new applicants.
-- 2. jobs_z_fit_rescore: when the description (compared without tags, spaces or
--    case), the skills or their tiers, the years, the salary range or budget, or
--    the locations change, every active candidate with a Gio Fit on the job is
--    queued as a re-score 10 minutes out; another change in those 10 minutes
--    pushes it back, so a burst of edits costs one re-score each, against the
--    final job. Only when the job's "Gio Fit scores every application" is on.
-- 3. fit_queue_rescore(association_ids): the bulk action (can_edit_job, GFQ01);
--    candidates without a Gio Fit get their first one.
-- 4. fit_queue_job_rescore_pending(job) / fit_queue_cancel_job_rescore(job): the
--    toast after a save says how many are waiting and can call it off.
--
-- A re-score never auto-rejects: jca_z_score_bar acts on a first score only.

alter table public.fit_analysis_queue
  add column if not exists priority smallint not null default 1;

create index if not exists fit_analysis_queue_due
  on public.fit_analysis_queue (priority, next_attempt_at)
  where status = 'pending';

-- The description as Gio Fit reads it: text only, spacing and case aside.
create or replace function public.fit_job_text(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(trim(regexp_replace(
    replace(regexp_replace(coalesce(t, ''), '<[^>]*>', ' ', 'g'), '&nbsp;', ' '),
    '\s+', ' ', 'g')))
$$;

create or replace function public.fit_queue_on_job_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create trigger jobs_z_fit_rescore
  after update of description, skills, skill_priorities, min_years_experience, max_years_experience,
    salary_min, salary_max, currency, budget_salary_min, budget_salary_max, budget_period, budget_currency,
    location, additional_locations
  on public.jobs
  for each row execute function public.fit_queue_on_job_change();

-- A scorecard re-scores at once, ahead of a waiting job-change re-score.
create or replace function public.fit_queue_on_scorecard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare assoc_id uuid;
begin
  if coalesce(new.is_ai_draft, false) then return new; end if;
  select a.id into assoc_id from job_candidate_associations a
   where a.id = new.association_id
     and a.ai_fit_analysis is not null
     and lower(coalesce(a.status, '')) not in ('rejected', 'withdrawn')
   limit 1;
  if assoc_id is null then return new; end if;
  insert into fit_analysis_queue (association_id, reason, priority) values (assoc_id, 'rescore', 1)
  on conflict (association_id) do update
    set status = 'pending', reason = 'rescore', priority = least(fit_analysis_queue.priority, 1),
        attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
    where fit_analysis_queue.status in ('done', 'failed')
       or (fit_analysis_queue.status = 'pending' and fit_analysis_queue.priority = 2);
  perform fit_queue_wake();
  return new;
end $$;

-- The bulk action: re-score (or score for the first time) the chosen candidates now.
create or replace function public.fit_queue_rescore(p_association_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued int;
  denied uuid;
begin
  if coalesce(array_length(p_association_ids, 1), 0) = 0 then
    return 0;
  end if;
  if array_length(p_association_ids, 1) > 500 then
    raise exception 'Re-score at most 500 candidates at a time' using errcode = 'GFQ02';
  end if;
  select a.job_id into denied
    from job_candidate_associations a
   where a.id = any (p_association_ids)
     and not public.can_edit_job(a.job_id)
   limit 1;
  if denied is not null then
    raise exception 'Only people who can edit this job can re-score its candidates' using errcode = 'GFQ01';
  end if;

  insert into fit_analysis_queue (association_id, reason, priority, status, attempts, next_attempt_at, last_error)
  select a.id, case when a.ai_fit_analysis is null then 'initial' else 'rescore' end, 0, 'pending', 0, now(), null
    from job_candidate_associations a
   where a.id = any (p_association_ids)
     and lower(coalesce(a.status, '')) not in ('rejected', 'withdrawn')
  on conflict (association_id) do update
     set status = 'pending', reason = excluded.reason, priority = 0, attempts = 0, last_error = null,
         next_attempt_at = now(), updated_at = now();
  get diagnostics queued = row_count;
  if queued > 0 then
    perform fit_queue_wake();
  end if;
  return queued;
end;
$$;

-- How many of a job's candidates wait for a job-change re-score.
create or replace function public.fit_queue_job_rescore_pending(p_job_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when public.can_edit_job(p_job_id) then (
    select count(*)::int
      from fit_analysis_queue q
      join job_candidate_associations a on a.id = q.association_id
     where a.job_id = p_job_id and q.status = 'pending' and q.priority = 2 and q.next_attempt_at > now()
  ) else 0 end
$$;

-- "Don't re-score": the waiting job-change re-scores are called off; scores stay as they are.
create or replace function public.fit_queue_cancel_job_rescore(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  called_off int;
begin
  if not public.can_edit_job(p_job_id) then
    raise exception 'Only people who can edit this job can change its re-scores' using errcode = 'GFQ01';
  end if;
  update fit_analysis_queue q
     set status = 'done', priority = 1, updated_at = now()
    from job_candidate_associations a
   where a.id = q.association_id and a.job_id = p_job_id
     and q.status = 'pending' and q.priority = 2;
  get diagnostics called_off = row_count;
  return called_off;
end;
$$;

revoke all on function public.fit_queue_rescore(uuid[]) from public, anon;
revoke all on function public.fit_queue_job_rescore_pending(uuid) from public, anon;
revoke all on function public.fit_queue_cancel_job_rescore(uuid) from public, anon;
grant execute on function public.fit_queue_rescore(uuid[]) to authenticated;
grant execute on function public.fit_queue_job_rescore_pending(uuid) to authenticated;
grant execute on function public.fit_queue_cancel_job_rescore(uuid) to authenticated;
