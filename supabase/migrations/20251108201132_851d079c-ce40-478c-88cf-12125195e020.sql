-- ======================================================
-- TENANT/DEPARTMENT SEPARATION - WORKING VERSION
-- ======================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tenant_type TEXT NOT NULL CHECK (tenant_type IN ('platform', 'saas', 'internal')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  billing_email TEXT,
  billing_contact_name TEXT,
  billing_phone TEXT,
  billing_address TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_postal_code TEXT,
  billing_country TEXT DEFAULT 'US',
  subscription_plan TEXT,
  subscription_status TEXT,
  subscription_renewal_date DATE,
  signup_source TEXT,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  suspended_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  owner_id UUID REFERENCES auth.users(id),
  settings JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tenants_type ON public.tenants(tenant_type);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- Migrate parent orgs to tenants
INSERT INTO public.tenants (
  id, name, tenant_type, status, billing_email, billing_phone,
  subscription_plan, subscription_status, subscription_renewal_date,
  signup_source, trial_end_date, suspended_at, suspended_reason,
  created_at, updated_at, owner_id
)
SELECT 
  id, name, COALESCE(tenant_type, 'internal'), status,
  billing_poc_additional_email, billing_poc_phone, plan_type,
  CASE WHEN status = 'active' THEN 'active'
       WHEN status = 'suspended' THEN 'suspended'
       ELSE 'inactive' END,
  renewal_date, signup_source, trial_end_date, suspended_at,
  suspended_reason, created_at, updated_at, owner_id
FROM public.organizations
WHERE parent_organization_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Add tenant_id columns
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Create helper functions
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT m.tenant_id FROM public.members m 
  WHERE m.user_id = auth.uid() AND m.user_status = 'active'
  ORDER BY m.created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant_access(check_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid() AND m.tenant_id = check_tenant_id
      AND m.user_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid() AND m.user_type = 'platform_admin'
      AND m.user_status = 'active'
  );
$$;

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_platform_admin_all ON public.tenants;
DROP POLICY IF EXISTS tenants_users_select_own ON public.tenants;

CREATE POLICY tenants_platform_admin_all ON public.tenants FOR ALL TO public
USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE POLICY tenants_users_select_own ON public.tenants FOR SELECT TO public
USING (user_has_tenant_access(id));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON public.jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_candidates_tenant_id ON public.candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_members_tenant_id ON public.members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_members_tenant_user ON public.members(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_id ON public.activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_id ON public.email_logs(tenant_id);

-- Comments
COMMENT ON TABLE public.tenants IS 'Actual workspaces/customers: Virgilio, internal clients, SaaS customers';
COMMENT ON TABLE public.organizations IS 'Departments/folders within a tenant for organizing jobs';
COMMENT ON COLUMN public.organizations.tenant_id IS 'Parent tenant this department belongs to';