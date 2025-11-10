-- Migration 1: Migrate template tables from organization_id to tenant_id
-- Step 1: Drop existing RLS policies that depend on organization_id

-- Job Stages policies
DROP POLICY IF EXISTS "Organization members can view job stages" ON job_stages;
DROP POLICY IF EXISTS "Workspace owners can manage organization job stages" ON job_stages;

-- Offer Templates policies
DROP POLICY IF EXISTS "Organization members can view offer templates" ON offer_templates;
DROP POLICY IF EXISTS "Workspace owners can manage organization offer templates" ON offer_templates;

-- Application Fields policies
DROP POLICY IF EXISTS "Organization members can view application fields" ON application_fields;
DROP POLICY IF EXISTS "Workspace owners can manage organization application fields" ON application_fields;

-- Contract Templates policies
DROP POLICY IF EXISTS "Organization members can view contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Workspace owners can manage organization contract templates" ON contract_templates;

-- Step 2: Add tenant_id columns to all template tables
ALTER TABLE job_stages ADD COLUMN tenant_id uuid REFERENCES tenants(id);
ALTER TABLE offer_templates ADD COLUMN tenant_id uuid REFERENCES tenants(id);
ALTER TABLE application_fields ADD COLUMN tenant_id uuid REFERENCES tenants(id);
ALTER TABLE contract_templates ADD COLUMN tenant_id uuid REFERENCES tenants(id);

-- Step 3: Populate tenant_id from organization_id
UPDATE job_stages SET tenant_id = (
  SELECT o.tenant_id FROM organizations o WHERE o.id = job_stages.organization_id
) WHERE organization_id IS NOT NULL;

UPDATE offer_templates SET tenant_id = (
  SELECT o.tenant_id FROM organizations o WHERE o.id = offer_templates.organization_id
) WHERE organization_id IS NOT NULL;

UPDATE application_fields SET tenant_id = (
  SELECT o.tenant_id FROM organizations o WHERE o.id = application_fields.organization_id
) WHERE organization_id IS NOT NULL;

UPDATE contract_templates SET tenant_id = (
  SELECT o.tenant_id FROM organizations o WHERE o.id = contract_templates.organization_id
) WHERE organization_id IS NOT NULL;

-- Step 4: Drop organization_id columns
ALTER TABLE job_stages DROP COLUMN organization_id;
ALTER TABLE offer_templates DROP COLUMN organization_id;
ALTER TABLE application_fields DROP COLUMN organization_id;
ALTER TABLE contract_templates DROP COLUMN organization_id;

-- Step 5: Add indexes for performance
CREATE INDEX idx_job_stages_tenant_id ON job_stages(tenant_id);
CREATE INDEX idx_offer_templates_tenant_id ON offer_templates(tenant_id);
CREATE INDEX idx_application_fields_tenant_id ON application_fields(tenant_id);
CREATE INDEX idx_contract_templates_tenant_id ON contract_templates(tenant_id);

-- Step 6: Create new tenant-aware RLS policies

-- Job Stages policies
CREATE POLICY job_stages_select_consolidated ON job_stages
FOR SELECT USING (
  tenant_id IS NULL -- Platform defaults visible to all
  OR tenant_id = get_user_tenant_id() -- Tenant-scoped templates
);

CREATE POLICY job_stages_workspace_owner_manage ON job_stages
FOR ALL USING (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
) WITH CHECK (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
);

-- Offer Templates policies
CREATE POLICY offer_templates_select_consolidated ON offer_templates
FOR SELECT USING (
  tenant_id IS NULL 
  OR tenant_id = get_user_tenant_id()
);

CREATE POLICY offer_templates_workspace_owner_manage ON offer_templates
FOR ALL USING (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
) WITH CHECK (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
);

-- Application Fields policies
CREATE POLICY application_fields_select_consolidated ON application_fields
FOR SELECT USING (
  tenant_id IS NULL 
  OR tenant_id = get_user_tenant_id()
);

CREATE POLICY application_fields_workspace_owner_manage ON application_fields
FOR ALL USING (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
) WITH CHECK (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
);

-- Contract Templates policies
CREATE POLICY contract_templates_select_consolidated ON contract_templates
FOR SELECT USING (
  tenant_id IS NULL 
  OR tenant_id = get_user_tenant_id()
);

CREATE POLICY contract_templates_workspace_owner_manage ON contract_templates
FOR ALL USING (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
) WITH CHECK (
  tenant_id = get_user_tenant_id() 
  AND user_is_workspace_owner_in_tenant(tenant_id)
);