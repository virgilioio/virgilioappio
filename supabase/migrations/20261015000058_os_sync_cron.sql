-- Retry People & Access changes that didn't reach Gio Sales on the first try
-- (os-sync, design Part D, 2026-10-14). Every 5 minutes; an empty queue costs
-- one cheap call.
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
  ) as request_id;
  $cmd$
);
