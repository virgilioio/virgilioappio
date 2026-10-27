-- os-sync's schedule also wakes for commission roles and rules (2026-10-26).
--
-- The pg_cron job 'os-sync' calls the function only while something waits:
-- access changes (os_sync_queue) or rates (os_commission_rates). Roles and
-- rule versions waiting for Gio Sales weren't in that check, so a failed or
-- missed delivery was never retried. This adds them to the condition, editing
-- the job's own command in place so its secret lookup stays as it is.
do $$
declare
  j bigint;
  c text;
  n text;
begin
  select jobid, command into j, c from cron.job where jobname = 'os-sync';
  n := replace(c,
    'or exists (select 1 from public.os_commission_rates where sync_status = ''pending'')',
    'or exists (select 1 from public.os_commission_rates where sync_status = ''pending'')
     or exists (select 1 from public.os_commission_roles where sync_status = ''pending'')
     or exists (select 1 from public.os_commission_rules where sync_status = ''pending'')');
  if j is null or n = c then
    raise exception 'The os-sync job is not as expected, so its condition was left alone.';
  end if;
  perform cron.alter_job(job_id := j, command := n);
end $$;
