
-- 1. Table
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text NULL,
  color text NULL,
  is_archived boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false, -- true for "General" so it can't be archived/deleted
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX departments_tenant_name_unique
  ON public.departments (tenant_id, lower(name));
CREATE UNIQUE INDEX departments_tenant_slug_unique
  ON public.departments (tenant_id, slug);
CREATE INDEX departments_tenant_idx
  ON public.departments (tenant_id) WHERE is_archived = false;

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT ON public.departments TO anon; -- public careers page reads dept names
GRANT ALL ON public.departments TO service_role;

-- 3. RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin of the given tenant?
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND user_status = 'active'
      AND (
        user_type IN ('platform_admin', 'workspace_owner')
        OR system_role = 'admin'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated, anon;

-- Read: anyone in the tenant can read non-archived; anon can read all (for public careers)
CREATE POLICY "Departments are readable by tenant members"
  ON public.departments FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Departments are publicly readable for careers page"
  ON public.departments FOR SELECT
  TO anon
  USING (true);

-- Write: tenant admins only
CREATE POLICY "Tenant admins can insert departments"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update departments"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete non-system departments"
  ON public.departments FOR DELETE
  TO authenticated
  USING (public.is_tenant_admin(tenant_id) AND is_system = false);

-- 4. updated_at trigger
CREATE TRIGGER departments_set_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Guard "General" / system rows from being archived/renamed-to-empty
CREATE OR REPLACE FUNCTION public.protect_system_departments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_system = true THEN
    -- system row cannot be archived or renamed
    IF NEW.is_archived = true THEN
      RAISE EXCEPTION 'The default department cannot be archived';
    END IF;
    IF NEW.name <> OLD.name THEN
      RAISE EXCEPTION 'The default department cannot be renamed';
    END IF;
    IF NEW.is_system = false THEN
      RAISE EXCEPTION 'Cannot unflag the default department';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER departments_protect_system
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_departments();

-- 6. Add department_id to jobs
ALTER TABLE public.jobs
  ADD COLUMN department_id uuid NULL REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX jobs_department_id_idx ON public.jobs (department_id);

-- 7. Seed each existing tenant with the standard catalog + "General"
WITH tenants AS (
  SELECT id FROM public.organizations WHERE parent_organization_id IS NULL
),
seed_names(name, slug, is_system) AS (
  VALUES
    ('General', 'general', true),
    ('Engineering', 'engineering', false),
    ('Product', 'product', false),
    ('Design', 'design', false),
    ('Sales', 'sales', false),
    ('Marketing', 'marketing', false),
    ('People', 'people', false),
    ('Finance', 'finance', false),
    ('Operations', 'operations', false),
    ('Customer Success', 'customer-success', false)
)
INSERT INTO public.departments (tenant_id, name, slug, is_system)
SELECT t.id, s.name, s.slug, s.is_system
FROM tenants t CROSS JOIN seed_names s
ON CONFLICT DO NOTHING;

-- 8. Backfill jobs.department_id → tenant's "General"
UPDATE public.jobs j
SET department_id = d.id
FROM public.departments d
WHERE d.is_system = true
  AND d.tenant_id = j.tenant_id
  AND j.department_id IS NULL;
