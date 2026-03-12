
-- Create whatsapp_templates table
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'UTILITY',
  language text NOT NULL DEFAULT 'en',
  body_template text NOT NULL,
  variable_mapping jsonb DEFAULT '{}',
  twilio_content_sid text,
  approval_status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own templates + global templates (tenant_id IS NULL)
CREATE POLICY "Tenants can read own and global templates"
ON public.whatsapp_templates
FOR SELECT
TO authenticated
USING (
  tenant_id IS NULL 
  OR user_has_tenant_access(tenant_id)
);

-- Only admins can insert/update tenant templates
CREATE POLICY "Admins can manage tenant templates"
ON public.whatsapp_templates
FOR ALL
TO authenticated
USING (
  tenant_id IS NOT NULL 
  AND user_has_tenant_access(tenant_id)
)
WITH CHECK (
  tenant_id IS NOT NULL 
  AND user_has_tenant_access(tenant_id)
);

-- Index for fast lookups
CREATE INDEX idx_whatsapp_templates_tenant ON public.whatsapp_templates(tenant_id);
CREATE INDEX idx_whatsapp_templates_status ON public.whatsapp_templates(approval_status);
