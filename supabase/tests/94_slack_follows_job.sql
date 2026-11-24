-- A job's Slack automations and their message log go with the job; booked
-- interviews and Gio Sign agreements still keep a job from going. Reads the
-- catalogue only, so it changes nothing.
do $t$
declare
  r text := '';
  kind "char";
  n int;
begin
  select confdeltype into kind from pg_constraint where conname = 'slack_automations_job_id_fkey';
  r := 'automations_follow_job=' || (kind = 'c');
  select confdeltype into kind from pg_constraint where conname = 'slack_deliveries_automation_id_fkey';
  r := r || ' log_follows_automation=' || (kind = 'c');
  select confdeltype into kind from pg_constraint where conname = 'scheduled_bookings_job_id_fkey';
  r := r || ' bookings_still_block=' || (kind = 'a');
  select confdeltype into kind from pg_constraint where conname = 'sign_envelopes_ats_job_id_fkey';
  r := r || ' agreements_still_block=' || (kind = 'a');
  -- Nothing else refuses a job's removal.
  select count(*) into n from pg_constraint
   where contype = 'f' and confrelid = 'public.jobs'::regclass and confdeltype not in ('c', 'n', 'd')
     and conname not in ('scheduled_bookings_job_id_fkey', 'sign_envelopes_ats_job_id_fkey');
  r := r || ' nothing_else_blocks=' || (n = 0);
  raise exception 'RESULT %', r;
end $t$;
