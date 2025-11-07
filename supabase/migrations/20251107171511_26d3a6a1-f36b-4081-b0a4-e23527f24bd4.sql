-- Add direction field to distinguish sent vs received emails
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS direction text CHECK (direction IN ('sent', 'received'));

-- Default existing records to 'sent'
UPDATE email_logs SET direction = 'sent' WHERE direction IS NULL;

-- Make direction required (only if column exists and we have data)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'email_logs' AND column_name = 'direction') THEN
    ALTER TABLE email_logs ALTER COLUMN direction SET NOT NULL;
  END IF;
END $$;

-- Add threading and reply fields (only if they don't exist)
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS in_reply_to text,
ADD COLUMN IF NOT EXISTS received_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS gmail_labels text[],
ADD COLUMN IF NOT EXISTS raw_message_data jsonb;

-- Add indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_email_logs_in_reply_to ON email_logs(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_email_logs_direction ON email_logs(direction);
CREATE INDEX IF NOT EXISTS idx_email_logs_is_read ON email_logs(is_read) WHERE is_read = false;

-- Add Gmail sync fields to user_mail_identities (only if they don't exist)
ALTER TABLE user_mail_identities
ADD COLUMN IF NOT EXISTS gmail_history_id text,
ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone;