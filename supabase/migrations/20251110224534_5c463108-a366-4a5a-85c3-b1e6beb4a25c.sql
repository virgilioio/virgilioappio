-- Create tenant_domains table for domain-based auto-join
CREATE TABLE public.tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  verification_method TEXT CHECK (verification_method IN ('dns', 'email', 'manual')),
  added_by UUID NOT NULL REFERENCES auth.users(id),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tenant_domains_unique_domain UNIQUE (domain),
  CONSTRAINT tenant_domains_lowercase_domain CHECK (domain = LOWER(domain))
);

CREATE INDEX idx_tenant_domains_tenant_id ON public.tenant_domains(tenant_id);
CREATE INDEX idx_tenant_domains_domain ON public.tenant_domains(domain) WHERE verified = true;

-- Validation trigger to ensure tenant_id references a parent tenant
CREATE OR REPLACE FUNCTION public.validate_tenant_domains_parent_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = NEW.tenant_id 
    AND o.org_kind = 'tenant' 
    AND o.parent_organization_id IS NULL
  ) THEN
    RAISE EXCEPTION 'tenant_id must reference a parent tenant organization';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_tenant_domains_parent_org
BEFORE INSERT OR UPDATE ON public.tenant_domains
FOR EACH ROW
EXECUTE FUNCTION public.validate_tenant_domains_parent_org();

-- Enable RLS
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant members can view their domains"
  ON public.tenant_domains FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Workspace owners can manage domains"
  ON public.tenant_domains FOR ALL
  USING (
    tenant_id = get_user_tenant_id() 
    AND user_is_workspace_owner_in_tenant(tenant_id)
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id() 
    AND user_is_workspace_owner_in_tenant(tenant_id)
  );

CREATE POLICY "Platform admins can manage all domains"
  ON public.tenant_domains FOR ALL
  USING (get_user_type_secure() = 'platform_admin')
  WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Domain utility functions

-- Extract domain from email address
CREATE OR REPLACE FUNCTION public.extract_domain_from_email(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN LOWER(SPLIT_PART(email, '@', 2));
END;
$$;

-- Check if domain is a public/free email provider
CREATE OR REPLACE FUNCTION public.is_public_email_domain(domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT domain IN (
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
    'icloud.com', 'protonmail.com', 'aol.com', 'mail.com',
    'zoho.com', 'yandex.com', 'gmx.com', 'tutanota.com'
  );
$$;

-- Find verified tenant for a given domain
CREATE OR REPLACE FUNCTION public.get_tenant_for_verified_domain(p_domain TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id 
  FROM tenant_domains
  WHERE domain = LOWER(p_domain)
    AND verified = true
  LIMIT 1;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_tenant_domains_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenant_domains_updated_at
BEFORE UPDATE ON public.tenant_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_tenant_domains_updated_at();