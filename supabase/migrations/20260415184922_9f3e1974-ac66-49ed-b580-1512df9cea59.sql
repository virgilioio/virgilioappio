
-- Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the cron job to call send-scheduled-emails every minute
SELECT cron.schedule(
  'send-scheduled-emails',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/send-scheduled-emails',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
