-- Run after 20261017010000_quiet_cron inside a transaction that is rolled back.
-- Every check returns ok = true.
select 'no written-in secrets' as check, not exists (select 1 from cron.job where command ~ '[0-9a-f]{64}') as ok
union all
select 'gmail v2 still scheduled', exists (select 1 from cron.job where jobname = 'sync-all-gmail-accounts-v2' and active)
union all
select 'frequent jobs gated: ' || n, exists (select 1 from cron.job where jobname = n and command ilike '%where exists%')
from unnest(array['process-automation-emails','send-scheduled-emails','chat-notification-processor','sign-dispatch','sign-seal','os-sync','deliver-integration-outbox-retry']) n
union all
select 'vault secret used: ' || n, exists (select 1 from cron.job where jobname = n and command ilike '%internal_function_secret%')
from unnest(array['process-automation-emails','send-scheduled-emails','sync-all-gmail-accounts-v2','renew-calendar-webhooks-daily']) n
;

-- Each gate is valid SQL (run on its own; the HTTP call itself is not made).
do $$
declare j record;
begin
  for j in select jobname, substring(command from '(?i)(where exists[\s\S]*);\s*$') as gate from cron.job where command ~* 'where exists' loop
    execute 'select 1 ' || j.gate;
  end loop;
end;
$$;
select 'gates run' as check, true as ok;
