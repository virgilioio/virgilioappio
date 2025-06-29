
-- Fix the get_exchange_rate_cron_status function to return proper timestamp with time zone
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
      THEN ((now() + interval '1 day')::date + time '02:00:00')::timestamp with time zone
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
