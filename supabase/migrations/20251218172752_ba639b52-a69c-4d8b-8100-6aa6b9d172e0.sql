-- Add jhs_id column to scheduled_emails for contextual booking links
ALTER TABLE public.scheduled_emails 
ADD COLUMN IF NOT EXISTS jhs_id UUID REFERENCES public.job_hiring_stages(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_jhs_id ON public.scheduled_emails(jhs_id);