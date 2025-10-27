-- Add webhook tracking columns to calendar_identities
ALTER TABLE calendar_identities
  ADD COLUMN webhook_channel_id TEXT,
  ADD COLUMN webhook_resource_id TEXT,
  ADD COLUMN webhook_expiration TIMESTAMPTZ,
  ADD COLUMN last_webhook_renewal TIMESTAMPTZ;

-- Create index for efficient webhook expiration queries
CREATE INDEX idx_calendar_identities_webhook_expiration 
  ON calendar_identities(webhook_expiration) 
  WHERE webhook_channel_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN calendar_identities.webhook_channel_id IS 
  'Google Calendar Push Notification channel ID';
COMMENT ON COLUMN calendar_identities.webhook_resource_id IS 
  'Google Calendar Push Notification resource ID';
COMMENT ON COLUMN calendar_identities.webhook_expiration IS 
  'When the webhook subscription expires (Google limit: ~7 days)';
COMMENT ON COLUMN calendar_identities.last_webhook_renewal IS 
  'Last time we renewed the webhook subscription';