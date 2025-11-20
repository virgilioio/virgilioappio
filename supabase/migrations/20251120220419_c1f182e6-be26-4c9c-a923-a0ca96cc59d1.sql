-- Add history_id to user_mail_identities for Gmail History API incremental sync
ALTER TABLE public.user_mail_identities
ADD COLUMN IF NOT EXISTS history_id TEXT;

-- Enable Realtime for email_logs table
ALTER TABLE public.email_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_logs;

-- Create index for faster email log queries
CREATE INDEX IF NOT EXISTS idx_email_logs_candidate_created 
ON public.email_logs(candidate_id, created_at DESC);

-- Schedule Gmail sync every 2 minutes (faster polling for hybrid approach)
SELECT cron.schedule(
  'sync-all-gmail-accounts',
  '*/2 * * * *',  -- Every 2 minutes
  $$
  SELECT
    net.http_post(
        url:='https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/sync-all-gmail-accounts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44"}'::jsonb
    ) as request_id;
  $$
);

COMMENT ON COLUMN public.user_mail_identities.history_id IS 
  'Gmail History API historyId for incremental sync. Tracks the last sync point to fetch only new changes.';