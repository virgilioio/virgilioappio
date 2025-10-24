-- Migration B: email_logs table for tracking sent emails

CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Sender info
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mail_identity_id UUID REFERENCES public.user_mail_identities(id) ON DELETE SET NULL,
  
  -- Email details
  from_address TEXT NOT NULL,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  
  -- Related entities
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  thread_id TEXT, -- External provider thread ID for conversation tracking
  
  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  provider_message_id TEXT, -- External provider's message ID
  error_message TEXT,
  
  -- Metadata
  attachments JSONB DEFAULT '[]'::jsonb, -- Array of {name, size, type, url}
  headers JSONB DEFAULT '{}'::jsonb, -- Custom email headers
  
  -- Tracking
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit fields
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX idx_email_logs_org_id ON public.email_logs(organization_id);
CREATE INDEX idx_email_logs_candidate_id ON public.email_logs(candidate_id);
CREATE INDEX idx_email_logs_job_id ON public.email_logs(job_id);
CREATE INDEX idx_email_logs_thread_id ON public.email_logs(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_email_logs_status ON public.email_logs(status, created_at DESC);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at DESC) WHERE sent_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_logs

-- Organization members can view email logs for their org
CREATE POLICY "Org members can view email logs"
  ON public.email_logs
  FOR SELECT
  USING (
    (get_user_type_secure() = 'platform_admin') OR
    (organization_id IS NOT NULL AND check_org_member_access(organization_id))
  );

-- Users can insert their own email sends
CREATE POLICY "Users can insert their own email sends"
  ON public.email_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (
      (get_user_type_secure() = 'platform_admin') OR
      (organization_id IS NOT NULL AND check_org_member_access(organization_id))
    )
  );

-- Users can update their own email logs (for tracking opens/clicks)
CREATE POLICY "Users can update their own email logs"
  ON public.email_logs
  FOR UPDATE
  USING (auth.uid() = user_id OR get_user_type_secure() = 'platform_admin')
  WITH CHECK (auth.uid() = user_id OR get_user_type_secure() = 'platform_admin');

-- Platform admins can manage all email logs
CREATE POLICY "Platform admins can manage all email logs"
  ON public.email_logs
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_email_logs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_logs_updated_at();

-- Comments
COMMENT ON TABLE public.email_logs IS 'Tracks all emails sent through the platform for audit and analytics';
COMMENT ON COLUMN public.email_logs.thread_id IS 'External provider thread ID for tracking email conversations';
COMMENT ON COLUMN public.email_logs.provider_message_id IS 'Message ID returned by email provider (Gmail, Outlook, etc)';
COMMENT ON COLUMN public.email_logs.status IS 'Current delivery status of the email';