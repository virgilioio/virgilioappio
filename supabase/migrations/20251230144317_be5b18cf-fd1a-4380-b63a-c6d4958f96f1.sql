-- Add email tracking columns to members table for P1 reliability
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS invitation_email_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS invitation_email_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS invitation_email_error text;

-- Create index for filtering by email status
CREATE INDEX IF NOT EXISTS idx_members_invitation_email_status 
ON public.members(invitation_email_status) 
WHERE invitation_email_status IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.members.invitation_email_sent_at IS 'Timestamp when invitation email was sent';
COMMENT ON COLUMN public.members.invitation_email_status IS 'Status: pending, sent, delivered, failed, bounced';
COMMENT ON COLUMN public.members.invitation_email_error IS 'Error message if email delivery failed';