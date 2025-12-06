-- Add rejection metadata columns to job_candidate_associations
ALTER TABLE public.job_candidate_associations 
ADD COLUMN IF NOT EXISTS rejection_reason_id UUID REFERENCES public.rejection_reasons(id),
ADD COLUMN IF NOT EXISTS rejection_email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_email_scheduled_for TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_by UUID;

-- Create scheduled_emails table for email scheduling
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  email_type TEXT NOT NULL DEFAULT 'rejection',
  
  -- Email content
  from_email TEXT NOT NULL,
  to_emails TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  
  -- Context
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  association_id UUID REFERENCES public.job_candidate_associations(id) ON DELETE SET NULL,
  rejection_reason_id UUID REFERENCES public.rejection_reasons(id) ON DELETE SET NULL,
  
  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

-- Create index for efficient querying of pending scheduled emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending 
ON public.scheduled_emails(scheduled_for) 
WHERE status = 'pending';

-- Create index for tenant isolation
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_tenant 
ON public.scheduled_emails(tenant_id);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduled_emails
CREATE POLICY "Platform admins can manage all scheduled emails"
ON public.scheduled_emails
FOR ALL
USING (public.get_user_type_secure() = 'platform_admin');

CREATE POLICY "Users can manage scheduled emails in their tenant"
ON public.scheduled_emails
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = scheduled_emails.tenant_id
    AND m.user_status = 'active'
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_emails_updated_at
BEFORE UPDATE ON public.scheduled_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();