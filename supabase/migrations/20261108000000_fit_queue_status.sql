-- Who on a job is waiting for Gio Fit (2026-11-08, Allan): the pipeline's Match
-- column, list view and board cards show a re-score in progress. The queue itself
-- stays closed to the browser; this reads only a job's own pending rows, for
-- anyone who can see that job's pipeline.
--
-- due_at: when the row is due (a job-change re-score waits 10 minutes);
-- due: it's due now (in line or being scored).

create or replace function public.fit_queue_job_status(p_job_id uuid)
returns table (association_id uuid, due_at timestamptz, due boolean)
language sql
stable
security definer
set search_path = public
as $$
  select q.association_id, q.next_attempt_at, q.next_attempt_at <= now()
    from fit_analysis_queue q
    join job_candidate_associations a on a.id = q.association_id
   where a.job_id = p_job_id
     and q.status = 'pending'
     and public.can_access_job_pipeline(p_job_id)
$$;

revoke all on function public.fit_queue_job_status(uuid) from public, anon;
grant execute on function public.fit_queue_job_status(uuid) to authenticated;
