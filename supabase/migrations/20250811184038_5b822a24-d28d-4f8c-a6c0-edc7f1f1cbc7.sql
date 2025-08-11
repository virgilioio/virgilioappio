-- Tenantization migration: add parent-child relationships and tenant scoping to organizations

-- 1) Create enum for organization kind
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'org_kind_enum'
  ) THEN
    CREATE TYPE public.org_kind_enum AS ENUM ('tenant', 'client', 'department');
  END IF;
END
$$;

-- 2) Add columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS parent_organization_id uuid NULL,
  ADD COLUMN IF NOT EXISTS org_kind public.org_kind_enum NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS tenant_id uuid NULL;

-- 3) Add FKs (with guards)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organizations_parent_fk'
      AND table_name = 'organizations'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_parent_fk
      FOREIGN KEY (parent_organization_id)
      REFERENCES public.organizations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organizations_tenant_fk'
      AND table_name = 'organizations'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_tenant_fk
      FOREIGN KEY (tenant_id)
      REFERENCES public.organizations(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- 4) Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_organizations_org_kind ON public.organizations(org_kind);
CREATE INDEX IF NOT EXISTS idx_organizations_parent ON public.organizations(parent_organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_tenant ON public.organizations(tenant_id);

-- 5) Trigger to automatically maintain tenant_id and enforce parent rules
CREATE OR REPLACE FUNCTION public.assign_organization_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  parent_tenant uuid;
  parent_kind public.org_kind_enum;
BEGIN
  -- Tenants cannot have parents and should point tenant_id to self
  IF NEW.org_kind = 'tenant' THEN
    NEW.parent_organization_id := NULL;
    NEW.tenant_id := NEW.id;
    RETURN NEW;
  END IF;

  -- For non-tenant orgs, compute tenant from parent if provided
  IF NEW.parent_organization_id IS NOT NULL THEN
    SELECT o.tenant_id, o.org_kind
      INTO parent_tenant, parent_kind
    FROM public.organizations o
    WHERE o.id = NEW.parent_organization_id;

    IF parent_kind = 'tenant' THEN
      NEW.tenant_id := NEW.parent_organization_id;
    ELSE
      NEW.tenant_id := parent_tenant; -- inherit ancestor tenant
    END IF;
  ELSE
    -- No parent set: leave as-is (null) for now
    NEW.tenant_id := NEW.tenant_id; 
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_organization_tenant ON public.organizations;
CREATE TRIGGER trg_assign_organization_tenant
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.assign_organization_tenant();

-- 6) Helper to retrieve current user's tenant (first membership considered)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_org_id uuid;
  v_tenant_id uuid;
  v_kind public.org_kind_enum;
BEGIN
  SELECT m.organization_id INTO v_org_id
  FROM public.members m
  WHERE m.user_id = auth.uid()
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT o.tenant_id, o.org_kind INTO v_tenant_id, v_kind
  FROM public.organizations o
  WHERE o.id = v_org_id;

  IF v_kind = 'tenant' THEN
    RETURN v_org_id;
  END IF;

  RETURN v_tenant_id; -- may be null if org has no parent; acceptable initial state
END;
$$;