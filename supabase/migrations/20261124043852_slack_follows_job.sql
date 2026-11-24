-- A job's own Slack automations go with the job (Allan, Go! 2026-11-24).
--
-- Deleting a job failed for any job set up with "Tell the hiring team in
-- Slack": its automations (slack_automations.job_id) pointed at the job with
-- no ON DELETE, so the database refused the delete and the dialog said
-- "Couldn't delete … Nothing was removed". A job's automations, and the log of
-- the messages they sent (slack_deliveries.automation_id), now go with it, like
-- the job's hiring plan and stage automations. Never SET NULL: an automation
-- with no job is workspace-wide and would start firing for every job.
--
-- Booked interviews (scheduled_bookings) and Gio Sign agreements
-- (sign_envelopes.ats_job_id) still block a delete on purpose: that history
-- stays, and the dialog offers Archive job instead.
--
-- Each constraint is replaced in one ALTER TABLE, so neither table is ever
-- without its link. This file removes and re-adds constraints, which the cloud
-- connector refuses: it is applied from a desktop chat.

alter table public.slack_automations
  drop constraint slack_automations_job_id_fkey,
  add constraint slack_automations_job_id_fkey
    foreign key (job_id) references public.jobs(id) on delete cascade;

alter table public.slack_deliveries
  drop constraint slack_deliveries_automation_id_fkey,
  add constraint slack_deliveries_automation_id_fkey
    foreign key (automation_id) references public.slack_automations(id) on delete cascade;
