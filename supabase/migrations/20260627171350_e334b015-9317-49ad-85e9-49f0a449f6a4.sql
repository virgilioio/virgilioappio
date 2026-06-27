
-- 1) Extend organizations (companies) table with CRM fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS hq_city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS account_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS description text;

-- 2) Extend status enum-like check to include 'prospect'
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'prospect'::text, 'inactive'::text]));

-- 3) Constrain company_size to known bands (nullable)
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_company_size_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_company_size_check
  CHECK (company_size IS NULL OR company_size = ANY (ARRAY['1-10','11-50','51-200','201-500','501-1000','1000+']));

-- 4) company_contacts table
CREATE TABLE IF NOT EXISTS public.company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role_title text,
  email text NOT NULL,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  tenant_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_contacts TO authenticated;
GRANT ALL ON public.company_contacts TO service_role;

-- Enforce at most one primary per company
CREATE UNIQUE INDEX IF NOT EXISTS company_contacts_one_primary_per_company
  ON public.company_contacts(company_id) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS company_contacts_company_id_idx ON public.company_contacts(company_id);
CREATE INDEX IF NOT EXISTS company_contacts_tenant_id_idx ON public.company_contacts(tenant_id);

-- 5) Auto-tenant + auto-unset previous primary
CREATE OR REPLACE FUNCTION public.company_contacts_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inherit tenant_id from parent company
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.organizations WHERE id = NEW.company_id;
  END IF;

  -- Touch updated_at on updates
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at = now();
  END IF;

  -- If marking primary, unset others in same company
  IF NEW.is_primary = true THEN
    UPDATE public.company_contacts
       SET is_primary = false, updated_at = now()
     WHERE company_id = NEW.company_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS company_contacts_before_write_trg ON public.company_contacts;
CREATE TRIGGER company_contacts_before_write_trg
  BEFORE INSERT OR UPDATE ON public.company_contacts
  FOR EACH ROW EXECUTE FUNCTION public.company_contacts_before_write();

-- 6) RLS
ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view company contacts"
  ON public.company_contacts FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can insert company contacts"
  ON public.company_contacts FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can update company contacts"
  ON public.company_contacts FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can delete company contacts"
  ON public.company_contacts FOR DELETE
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));
