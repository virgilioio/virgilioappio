-- Gio Fit queue (2026-11-06): candidates added to a job before it has a
-- description wait instead of being closed unscored, and the queue can't stall.
--
-- process-fit-queue now marks such rows 'waiting' (fit_analysis_queue.status is
-- free text). When the job's description is written, its waiting rows go back
-- to pending and the queue is woken. A sweep every two minutes wakes the queue
-- whenever work is due and no worker holds the lease, so a lost wake or a run
-- that was cut off never leaves candidates behind.

create or replace function public.fit_queue_release_waiting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  released int;
begin
  -- The same rule analyze-candidate-fit applies: 30 characters of text, tags aside.
  if length(trim(regexp_replace(coalesce(new.description, ''), '<[^>]*>', '', 'g'))) < 30 then
    return new;
  end if;
  update fit_analysis_queue q
     set status = 'pending', next_attempt_at = now(), updated_at = now()
    from job_candidate_associations a
   where a.id = q.association_id
     and a.job_id = new.id
     and q.status = 'waiting';
  get diagnostics released = row_count;
  if released > 0 then
    perform fit_queue_wake();
  end if;
  return new;
end $$;

revoke all on function public.fit_queue_release_waiting() from public, anon, authenticated;

create trigger jobs_z_fit_queue_release
  after update of description on public.jobs
  for each row
  when (old.description is distinct from new.description)
  execute function public.fit_queue_release_waiting();

create or replace function public.fit_queue_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from fit_analysis_queue where status = 'pending' and next_attempt_at <= now())
     and exists (select 1 from fit_analysis_queue_control
                  where id = 1 and paused_reason is null and (lease_until is null or lease_until < now())) then
    perform fit_queue_wake();
  end if;
end $$;

revoke all on function public.fit_queue_sweep() from public, anon, authenticated;

select cron.schedule('fit-queue-sweep', '*/2 * * * *', $cron$select public.fit_queue_sweep()$cron$);
