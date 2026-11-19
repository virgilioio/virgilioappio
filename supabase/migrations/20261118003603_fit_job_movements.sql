-- Gio Fit: which candidates on a job moved, and why (2026-11-17).
--
-- A job's lists and board show a small up or down marker beside a Gio Fit score
-- whose latest assessment changed it because something new was learned about the
-- candidate or the job: a scorecard, the application's answers, a new résumé or
-- profile, the job's details, a recruiter's Refresh. The cause is written by
-- analyze-candidate-fit (scoring.cause, recipe v5), so older assessments and a
-- change of recipe never show a marker. A move stays marked for 30 days.

create or replace function public.fit_job_movements(p_job_id uuid)
returns table (association_id uuid, score integer, previous_score integer, cause text, moved_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select h.association_id,
           h.score,
           h.scoring ->> 'cause' as cause,
           h.generated_at,
           lag(h.score) over (partition by h.association_id order by h.generated_at, h.version) as before,
           row_number() over (partition by h.association_id order by h.generated_at desc, h.version desc) as rn
      from fit_score_history h
     where h.job_id = p_job_id
  )
  select r.association_id, r.score, r.before, r.cause, r.generated_at
    from ranked r
   where r.rn = 1
     and r.score is not null
     and r.before is not null
     and abs(r.score - r.before) >= 2
     and r.cause in ('scorecard', 'application', 'profile', 'job', 'refresh')
     and r.generated_at > now() - interval '30 days'
     and public.can_access_job_pipeline(p_job_id)
$$;

comment on function public.fit_job_movements(uuid) is
  'Candidates on a job whose latest Gio Fit assessment moved their score by 2 points or more in the last 30 days, with what caused it. Only for people who can open the job''s pipeline.';

revoke all on function public.fit_job_movements(uuid) from public, anon;
grant execute on function public.fit_job_movements(uuid) to authenticated;
