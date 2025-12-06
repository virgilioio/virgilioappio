-- Create rejection_email_templates table
CREATE TABLE public.rejection_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  rejection_reason_id UUID REFERENCES public.rejection_reasons(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'custom',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_rejection_email_templates_tenant_id ON public.rejection_email_templates(tenant_id);

-- Enable RLS
ALTER TABLE public.rejection_email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Platform admins can manage all templates
CREATE POLICY "Platform admins can manage all rejection email templates"
ON public.rejection_email_templates
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

-- Workspace owners can manage tenant templates
CREATE POLICY "Workspace owners can manage tenant rejection email templates"
ON public.rejection_email_templates
FOR ALL
USING (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
)
WITH CHECK (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
);

-- All tenant members can view their tenant's templates + platform defaults
CREATE POLICY "Tenant members can view rejection email templates"
ON public.rejection_email_templates
FOR SELECT
USING (
  tenant_id IS NULL 
  OR tenant_id = get_user_tenant_id()
);

-- Trigger for updated_at
CREATE TRIGGER update_rejection_email_templates_updated_at
BEFORE UPDATE ON public.rejection_email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed platform default rejection email templates (tenant_id = NULL)

INSERT INTO public.rejection_email_templates (tenant_id, name, subject, body, source) VALUES
(NULL, 'Application Rejection', 'Update on your application for {{job.title}}', '<p>Dear {{candidate.first_name}},</p><p>Thank you for your interest in the {{job.title}} position at {{company.name}} and for taking the time to apply.</p><p>After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p><p>We appreciate your interest in joining our team and encourage you to apply for future opportunities that align with your skills and experience.</p><p>We wish you the best in your job search and future endeavors.</p><p>Best regards,<br>{{sender.first_name}} {{sender.last_name}}<br>{{company.name}}</p>', 'platform'),

(NULL, 'Post-Interview Rejection', 'Following up on your interview for {{job.title}}', '<p>Dear {{candidate.first_name}},</p><p>Thank you for taking the time to interview for the {{job.title}} position at {{company.name}}. We enjoyed learning more about your background and experience.</p><p>After careful deliberation, we have decided to proceed with another candidate whose experience more closely aligns with our current requirements.</p><p>This was a difficult decision as we were impressed with your qualifications. We will keep your resume on file and reach out if a more suitable opportunity arises.</p><p>Thank you again for your interest in {{company.name}}, and we wish you continued success in your career.</p><p>Best regards,<br>{{sender.first_name}} {{sender.last_name}}<br>{{company.name}}</p>', 'platform'),

(NULL, 'Final Round Rejection', 'Your application for {{job.title}} at {{company.name}}', '<p>Dear {{candidate.first_name}},</p><p>I wanted to personally reach out regarding your candidacy for the {{job.title}} position.</p><p>First, thank you for the time and effort you invested throughout our interview process. Your skills and experience made a strong impression on our team.</p><p>After much deliberation, we have decided to extend an offer to another candidate. This was an incredibly difficult decision given the strength of your candidacy.</p><p>We genuinely believe you would be an asset to any organization, and we hope you will consider us again for future opportunities.</p><p>Please don''t hesitate to reach out if you have any questions or would like feedback on your interviews.</p><p>With appreciation,<br>{{sender.first_name}} {{sender.last_name}}<br>{{company.name}}</p>', 'platform'),

(NULL, 'Candidate Withdrawal Acknowledgment', 'We understand - Thank you, {{candidate.first_name}}', '<p>Dear {{candidate.first_name}},</p><p>Thank you for letting us know about your decision to withdraw from consideration for the {{job.title}} position.</p><p>We completely understand and respect your decision. We appreciate the time you spent with us during the interview process.</p><p>Should your circumstances change in the future, we would welcome the opportunity to reconnect. Our door remains open.</p><p>Wishing you all the best in your career journey.</p><p>Warm regards,<br>{{sender.first_name}} {{sender.last_name}}<br>{{company.name}}</p>', 'platform');