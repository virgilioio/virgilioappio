
-- Add index for better performance on token lookups
CREATE INDEX IF NOT EXISTS idx_members_invite_expires_at 
ON public.members(invite_expires_at) 
WHERE user_status = 'invited';
