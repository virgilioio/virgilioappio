-- First, drop the old check constraint
ALTER TABLE user_mail_identities 
DROP CONSTRAINT IF EXISTS user_mail_identities_sync_status_check;

-- Update all existing records from 'healthy' to 'active'
UPDATE user_mail_identities 
SET sync_status = 'active' 
WHERE sync_status = 'healthy';

-- Add new check constraint with 'active' instead of 'healthy'
ALTER TABLE user_mail_identities 
ADD CONSTRAINT user_mail_identities_sync_status_check 
CHECK (sync_status IN ('active', 'error', 'expired'));