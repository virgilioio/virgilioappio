-- Enable required extensions for cron and HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the automation email processor to run every minute
SELECT cron.schedule(
  'process-automation-emails',           -- job name
  '* * * * *',                           -- every minute
  $$
  SELECT
    net.http_post(
      url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/process-automation-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUzMzcyMywiZXhwIjoyMDY1MTA5NzIzfQ.VYw2tUbGfPRRTnCy0-4xnZUIXm0w-g-vQBnLSAcPEKQ'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);