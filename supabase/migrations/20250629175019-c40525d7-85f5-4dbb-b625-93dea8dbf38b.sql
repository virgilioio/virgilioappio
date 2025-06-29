
-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests from cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a table to track automatic exchange rate updates
CREATE TABLE IF NOT EXISTS public.exchange_rate_update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_type TEXT NOT NULL CHECK (update_type IN ('automatic', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  message TEXT,
  stats JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on the logs table
ALTER TABLE public.exchange_rate_update_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for the logs table
CREATE POLICY "Platform admins can view all update logs"
  ON public.exchange_rate_update_logs FOR SELECT
  TO authenticated
  USING (get_user_type() = 'platform_admin');

CREATE POLICY "Users with invoice permissions can view update logs"
  ON public.exchange_rate_update_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.user_status = 'active'
      AND m.member_role = 'admin'
    )
  );

-- Create a function to execute the automatic exchange rate update
CREATE OR REPLACE FUNCTION public.execute_automatic_exchange_rate_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the start of automatic update
  INSERT INTO public.exchange_rate_update_logs (update_type, status, message)
  VALUES ('automatic', 'pending', 'Starting automatic exchange rate update');
  
  -- Make HTTP request to the edge function
  PERFORM net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/update-exchange-rates',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
END;
$$;

-- Create a function to manage the automatic update cron job
CREATE OR REPLACE FUNCTION public.manage_exchange_rate_cron(enable_cron BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_name TEXT := 'daily-exchange-rate-update';
BEGIN
  -- Only platform admins can manage the cron job
  IF get_user_type() != 'platform_admin' THEN
    RAISE EXCEPTION 'Only platform administrators can manage automatic exchange rate updates';
  END IF;

  IF enable_cron THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule(job_name);
    
    -- Schedule daily exchange rate update at 2:00 AM UTC
    PERFORM cron.schedule(
      job_name,
      '0 2 * * *',
      'SELECT public.execute_automatic_exchange_rate_update();'
    );
    
    RETURN 'Automatic exchange rate updates enabled. Updates will run daily at 2:00 AM UTC.';
  ELSE
    -- Disable the cron job
    PERFORM cron.unschedule(job_name);
    RETURN 'Automatic exchange rate updates disabled.';
  END IF;
END;
$$;

-- Create a function to get cron job status
CREATE OR REPLACE FUNCTION public.get_exchange_rate_cron_status()
RETURNS TABLE(
  is_enabled BOOLEAN,
  next_run TIMESTAMP WITH TIME ZONE,
  last_automatic_update TIMESTAMP WITH TIME ZONE,
  last_update_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only users with invoice permissions can view cron status
  IF get_user_type() != 'platform_admin' AND NOT EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
    AND m.user_status = 'active'
    AND m.member_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to view exchange rate update status';
  END IF;

  RETURN QUERY
  SELECT 
    EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'daily-exchange-rate-update') as is_enabled,
    CASE 
      WHEN EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'daily-exchange-rate-update') 
      THEN (now() + interval '1 day')::date + time '02:00:00'
      ELSE NULL 
    END as next_run,
    (SELECT created_at FROM public.exchange_rate_update_logs 
     WHERE update_type = 'automatic' 
     ORDER BY created_at DESC LIMIT 1) as last_automatic_update,
    (SELECT status FROM public.exchange_rate_update_logs 
     WHERE update_type = 'automatic' 
     ORDER BY created_at DESC LIMIT 1) as last_update_status;
END;
$$;

-- Add trigger to update the updated_at timestamp
CREATE TRIGGER handle_exchange_rate_logs_updated_at
  BEFORE UPDATE ON public.exchange_rate_update_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_exchange_rate_logs_type_created 
ON public.exchange_rate_update_logs(update_type, created_at DESC);
