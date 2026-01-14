-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a cron job to renew calendar webhooks daily at 3 AM UTC
SELECT cron.schedule(
  'renew-calendar-webhooks-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/renew-calendar-watches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);