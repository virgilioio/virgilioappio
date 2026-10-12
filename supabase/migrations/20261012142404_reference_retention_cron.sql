-- Privacy (2026-10-12): the reference retention sweeper existed but never ran.
-- It purges referee details once a reference check's retention window ends
-- (24 months by default) and declined referees after 30 days (Privacy Policy §8).
--
-- The internal function secret moves into Vault, copied from an existing job,
-- so it is never written into the repo.
do $$
declare
  s text;
begin
  if not exists (select 1 from vault.secrets where name = 'internal_function_secret') then
    select substring(command from '''x-internal-secret'',\s*''([0-9a-f]+)''')
      into s
      from cron.job
     where jobname = 'send-scheduled-emails';
    if s is null then
      raise exception 'internal function secret not found in cron job send-scheduled-emails';
    end if;
    perform vault.create_secret(s, 'internal_function_secret', 'x-internal-secret header for scheduled edge functions');
  end if;
end $$;

select cron.schedule(
  'reference-retention-sweeper',
  '40 3 * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/reference-retention-sweeper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $cmd$
);
