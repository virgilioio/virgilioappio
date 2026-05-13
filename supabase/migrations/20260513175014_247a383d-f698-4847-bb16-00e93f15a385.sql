
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any prior version so this is idempotent
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-fx-rates-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh-fx-rates-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/refresh-fx-rates',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);
