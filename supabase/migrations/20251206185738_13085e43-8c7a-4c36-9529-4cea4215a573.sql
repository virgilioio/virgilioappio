-- Create the missing email_suppression_list table that is_email_suppressed() references
CREATE TABLE IF NOT EXISTS public.email_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT, -- 'bounce', 'complaint', 'unsubscribe'
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all entries
CREATE POLICY "Platform admins can manage suppression list"
  ON public.email_suppression_list
  FOR ALL
  USING (public.is_platform_admin());

-- Tenant members can view their own tenant's suppressions
CREATE POLICY "Tenant members can view their suppression list"
  ON public.email_suppression_list
  FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

-- Create index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_email_suppression_list_email 
  ON public.email_suppression_list(email);

-- Add comment for documentation
COMMENT ON TABLE public.email_suppression_list IS 'Stores suppressed emails (bounces, complaints, unsubscribes) to prevent sending to them';