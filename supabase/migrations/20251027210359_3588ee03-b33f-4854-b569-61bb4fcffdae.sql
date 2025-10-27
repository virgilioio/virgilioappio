-- =====================================================
-- Phase 2.2: Nightly Cron Job for Trial Expiration
-- =====================================================

-- Schedule daily check at 2 AM UTC
SELECT cron.schedule(
  'lock-expired-trials',
  '0 2 * * *',  -- Every day at 2:00 AM UTC
  $$
  UPDATE public.tenant_subscriptions
  SET 
    billing_status = 'locked',
    updated_at = now()
  WHERE billing_status = 'trialing'
    AND trial_ends_at < now()
    AND (stripe_subscription_id IS NULL OR stripe_subscription_id = '');
  $$
);

-- Verify cron job is scheduled
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'lock-expired-trials';

COMMENT ON EXTENSION pg_cron IS 
  'Used for nightly trial expiration checks (lock-expired-trials job at 2 AM UTC)';