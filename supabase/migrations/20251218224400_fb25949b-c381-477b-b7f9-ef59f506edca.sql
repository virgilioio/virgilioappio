-- Add columns for proper RFC822 Message-ID and References header storage
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS rfc822_message_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS references_header TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS snippet TEXT;

-- Index for threading lookups by RFC822 Message-ID
CREATE INDEX IF NOT EXISTS idx_email_logs_rfc822_message_id ON email_logs(rfc822_message_id);

-- Composite index for faster deduplication by (mail_identity_id, provider_message_id)
CREATE INDEX IF NOT EXISTS idx_email_logs_identity_provider_id 
  ON email_logs(mail_identity_id, provider_message_id);

-- Unique constraint to enable proper upsert - need to handle existing duplicates first
-- First, identify and remove duplicates keeping only the first occurrence
DELETE FROM email_logs a USING email_logs b
WHERE a.id > b.id 
  AND a.mail_identity_id = b.mail_identity_id 
  AND a.provider_message_id = b.provider_message_id
  AND a.mail_identity_id IS NOT NULL
  AND a.provider_message_id IS NOT NULL;

-- Now add unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_identity_provider_unique 
  ON email_logs(mail_identity_id, provider_message_id) 
  WHERE mail_identity_id IS NOT NULL AND provider_message_id IS NOT NULL;