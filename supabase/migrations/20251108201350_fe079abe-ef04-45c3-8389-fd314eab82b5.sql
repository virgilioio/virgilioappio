-- ======================================================
-- DATA MIGRATION: Populate tenant_id across all tables
-- ======================================================

-- Update organizations tenant_id
UPDATE public.organizations o
SET tenant_id = o.parent_organization_id
WHERE o.parent_organization_id IS NOT NULL 
  AND (o.tenant_id IS NULL OR o.tenant_id != o.parent_organization_id);

UPDATE public.organizations o  
SET tenant_id = o.id
WHERE o.parent_organization_id IS NULL 
  AND (o.tenant_id IS NULL OR o.tenant_id != o.id);

-- Update jobs tenant_id
UPDATE public.jobs j
SET tenant_id = (
  SELECT o.tenant_id 
  FROM public.organizations o 
  WHERE o.id = j.organization_id
)
WHERE j.tenant_id IS NULL;

-- Update candidates tenant_id
UPDATE public.candidates c
SET tenant_id = (
  SELECT o.tenant_id 
  FROM public.organizations o 
  WHERE o.id = c.organization_id
)
WHERE c.tenant_id IS NULL 
  AND c.organization_id IS NOT NULL;

-- Update members tenant_id
UPDATE public.members m
SET tenant_id = (
  SELECT o.tenant_id 
  FROM public.organizations o 
  WHERE o.id = m.organization_id
)
WHERE m.tenant_id IS NULL;

-- Update activities tenant_id
UPDATE public.activities a
SET tenant_id = (
  SELECT o.tenant_id 
  FROM public.organizations o 
  WHERE o.id = a.organization_id
)
WHERE a.tenant_id IS NULL 
  AND a.organization_id IS NOT NULL;

-- Update email_logs tenant_id
UPDATE public.email_logs e
SET tenant_id = (
  SELECT o.tenant_id 
  FROM public.organizations o 
  WHERE o.id = e.organization_id
)
WHERE e.tenant_id IS NULL;

-- Now make tenant_id NOT NULL where appropriate
ALTER TABLE public.organizations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.jobs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.members ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN tenant_id SET NOT NULL;