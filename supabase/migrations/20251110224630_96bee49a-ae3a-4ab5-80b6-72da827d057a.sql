-- Fix search_path for domain-related functions to address security warnings

-- Update validate_tenant_domains_parent_org function
CREATE OR REPLACE FUNCTION public.validate_tenant_domains_parent_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Update extract_domain_from_email function
CREATE OR REPLACE FUNCTION public.extract_domain_from_email(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN LOWER(SPLIT_PART(email, '@', 2));
END;
$$;

-- Update update_tenant_domains_updated_at function
CREATE OR REPLACE FUNCTION public.update_tenant_domains_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;