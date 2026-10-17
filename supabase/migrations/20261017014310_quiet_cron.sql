-- Quiet the scheduled jobs (performance, 2026-10-17)
--
-- Every scheduled call to an Edge Function goes through pg_net, which leaves a
-- response row behind and clears it later. Five jobs called their function
-- every minute even when there was nothing to do, so the response table
-- churned constantly and its cleanup became the heaviest work in the database
-- (about 91 hours of database time since Aug 30).
--
-- This migration:
--   1. calls each frequent job's function only when it has work waiting
--      (same pattern as deliver-integration-outbox-retry already uses);
--   2. reads the internal function secret from Vault in every job instead of
--      a copy written into the job (same value, so nothing else changes);
--
-- The older Gmail sync job (sync-all-gmail-accounts, id 3) still runs next to
-- its replacement and is refused each time (it sends the anon key). It belongs
-- to another database role, so it can't be changed from a migration; it is
-- left as it is.
--
-- Commands are edited in place with cron.alter_job, so URLs, headers and
-- bodies stay exactly as they are. Each edit must match exactly once.

create or replace function pg_temp.edit_job(_name text, _pattern text, _replacement text)
returns void
language plpgsql
as $$
declare
  j record;
  next_cmd text;
begin
  select jobid, command into j from cron.job where jobname = _name;
  if not found then
    raise exception 'quiet_cron: job % not found', _name;
  end if;
  if (select count(*) from regexp_matches(j.command, _pattern, 'gi')) <> 1 then
    raise exception 'quiet_cron: job % does not match % exactly once', _name, _pattern;
  end if;
  next_cmd := regexp_replace(j.command, _pattern, _replacement, 'i');
  perform cron.alter_job(j.jobid, command := next_cmd);
end;
$$;

-- 1. Secret from Vault, not a copy in the job ------------------------------
select pg_temp.edit_job(n,
  $p$'x-internal-secret',\s*'[0-9a-f]{64}'$p$,
  $r$'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')$r$)
from unnest(array[
  'process-automation-emails',
  'send-scheduled-emails',
  'sync-all-gmail-accounts-v2',
  'renew-calendar-webhooks-daily'
]) n;

-- 2. Call only when there is work ------------------------------------------
-- Stage automations: time-based triggers need a sweep while any is active;
-- otherwise only runs that are due.
select pg_temp.edit_job('process-automation-emails',
  $p$\)\s*as request_id;$p$,
  $r$) as request_id
where exists (select 1 from public.stage_automations where is_active and trigger in ('idle', 'noreply', 'completed'))
   or exists (select 1 from public.stage_automation_runs where status = 'scheduled' and scheduled_for <= now());$r$);

select pg_temp.edit_job('send-scheduled-emails',
  $p$\)\s*as request_id;$p$,
  $r$) as request_id
where exists (select 1 from public.scheduled_emails where status = 'pending' and scheduled_for <= now());$r$);

select pg_temp.edit_job('chat-notification-processor',
  $p$\)\s*as request_id;$p$,
  $r$) as request_id
where exists (select 1 from public.chat_notification_queue where status = 'pending' and scheduled_for <= now());$r$);

select pg_temp.edit_job('sign-dispatch',
  $p$\)\s*as request_id;$p$,
  $r$) as request_id
where exists (
  select 1 from public.sign_envelopes
  where deleted_at is null
    and ((status = 'queued' and dispatch_at <= now()) or (status = 'scheduled' and scheduled_at <= now())));$r$);

select pg_temp.edit_job('sign-seal',
  $p$\)\s*as request_id;$p$,
  $r$) as request_id
where exists (
  select 1 from public.sign_envelopes
  where status = 'completed' and sealed_path is null and seal_attempts < 5
    and (seal_claimed_at is null or seal_claimed_at < now() - interval '10 minutes'));$r$);

select pg_temp.edit_job('os-sync',
  $p$\)\s*as request_id;$p$,
  $r$) as request_id
where exists (select 1 from public.os_sync_queue where status = 'pending');$r$);

-- Guard: no job may carry a secret written into its command.
do $$
begin
  if exists (select 1 from cron.job where command ~ '[0-9a-f]{64}') then
    raise exception 'quiet_cron: a scheduled job still holds a written-in secret';
  end if;
end;
$$;
