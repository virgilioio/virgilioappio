-- The os-sync cron (job 'os-sync', every 5 minutes) only called the function
-- when os_sync_queue had pending rows, so a commission rate that Gio Sales
-- couldn't take the first time was never retried. It now also fires while a
-- rate is waiting (os_commission_rates.sync_status = 'pending').
select cron.schedule(
  'os-sync',
  '*/5 * * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/os-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  ) as request_id
  where exists (select 1 from public.os_sync_queue where status = 'pending')
     or exists (select 1 from public.os_commission_rates where sync_status = 'pending')
  $cmd$
);
