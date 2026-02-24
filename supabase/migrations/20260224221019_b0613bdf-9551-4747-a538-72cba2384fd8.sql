-- Drop the broken partial unique index that prevents ON CONFLICT from working
DROP INDEX IF EXISTS idx_email_logs_identity_provider_unique;

-- Drop the redundant non-unique index (same columns)
DROP INDEX IF EXISTS idx_email_logs_identity_provider_id;

-- Create a proper unique constraint that Postgres ON CONFLICT can target
ALTER TABLE email_logs
  ADD CONSTRAINT uq_email_logs_identity_provider
  UNIQUE (mail_identity_id, provider_message_id);