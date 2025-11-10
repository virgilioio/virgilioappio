-- =====================================================
-- Phase 3: Data Integrity & Missing Policies
-- =====================================================

-- ==========================================
-- 3.1: Fix Job→Parent Org Violation
-- ==========================================

DO $$
DECLARE
  violating_job_id uuid := 'ab620524-56c7-4c62-a7ed-c3422a84bce2';
  parent_org_id uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  child_org_id uuid;
BEGIN
  SELECT id INTO child_org_id
  FROM organizations
  WHERE parent_organization_id = parent_org_id
  LIMIT 1;
  
  IF child_org_id IS NOT NULL THEN
    UPDATE jobs 
    SET organization_id = child_org_id, updated_at = now()
    WHERE id = violating_job_id;
    RAISE NOTICE 'Migrated job % to child org %', violating_job_id, child_org_id;
  ELSE
    INSERT INTO organizations (
      name, parent_organization_id, tenant_id, organization_type, tenant_type, created_at, updated_at
    )
    SELECT 'General Jobs', id, tenant_id, 'client', 'saas', now(), now()
    FROM organizations WHERE id = parent_org_id
    RETURNING id INTO child_org_id;
    
    UPDATE jobs 
    SET organization_id = child_org_id, updated_at = now()
    WHERE id = violating_job_id;
    RAISE NOTICE 'Created child org % and migrated job %', child_org_id, violating_job_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION is_child_organization(org_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = org_id AND parent_organization_id IS NOT NULL
  );
$$;

ALTER TABLE jobs ADD CONSTRAINT jobs_must_reference_child_org
CHECK (is_child_organization(organization_id));

-- ==========================================
-- 3.2: Add Members Table RLS Policies
-- ==========================================

DROP POLICY IF EXISTS "Users can view own member record" ON members;

CREATE POLICY members_insert_consolidated ON members FOR INSERT
WITH CHECK (
  is_platform_admin() OR
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = (SELECT tenant_id FROM organizations WHERE id = organization_id)
    AND m.user_type = 'workspace_owner'
    AND m.user_status = 'active'
  )
);

CREATE POLICY members_select_consolidated ON members FOR SELECT
USING (
  is_platform_admin() OR
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = members.tenant_id
    AND m.user_type = 'workspace_owner'
    AND m.user_status = 'active'
  )
);

CREATE POLICY members_update_consolidated ON members FOR UPDATE
USING (
  is_platform_admin() OR
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = members.tenant_id
    AND m.user_type = 'workspace_owner'
    AND m.user_status = 'active'
  ) OR
  user_id = auth.uid()
)
WITH CHECK (
  is_platform_admin() OR
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = members.tenant_id
    AND m.user_type = 'workspace_owner'
    AND m.user_status = 'active'
  )
);

CREATE POLICY members_delete_blocked ON members FOR DELETE
USING (false);

-- ==========================================
-- 3.3: Update Scorecards Policies
-- ==========================================

DROP POLICY IF EXISTS "Users can update their own scorecards" ON job_stage_scorecards;
DROP POLICY IF EXISTS "Authors/admin can update scorecards" ON job_stage_scorecards;

CREATE POLICY scorecards_update_24h_window ON job_stage_scorecards FOR UPDATE
USING (
  (created_by = auth.uid() AND created_at > (now() - INTERVAL '24 hours')) OR
  is_platform_admin()
)
WITH CHECK (
  (created_by = auth.uid() AND created_at > (now() - INTERVAL '24 hours')) OR
  is_platform_admin()
);

-- ==========================================
-- 3.4: Implement Soft Delete
-- ==========================================

-- Add deleted_at columns to existing tables only
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE job_assignments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_deleted_at ON candidates(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_postings_deleted_at ON job_postings(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_assignments_deleted_at ON job_assignments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Soft delete helper function
CREATE OR REPLACE FUNCTION soft_delete_record(table_name text, record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can use this function';
  END IF;
  
  EXECUTE format(
    'UPDATE %I SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id', 
    table_name
  ) USING record_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record not found or already deleted');
  END IF;
  
  PERFORM log_audit_event(
    'soft_delete_' || table_name, table_name, record_id::text, auth.uid(),
    NULL, jsonb_build_object('deleted_at', now())
  );
  
  RETURN jsonb_build_object('success', true, 'record_id', record_id, 'table', table_name);
END;
$$;

-- Admin restore function
CREATE OR REPLACE FUNCTION admin_restore_record(table_name text, record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can restore records';
  END IF;
  
  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL, updated_at = now() WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id',
    table_name
  ) USING record_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record not found or not deleted');
  END IF;
  
  PERFORM log_audit_event(
    'restore_' || table_name, table_name, record_id::text, auth.uid(),
    jsonb_build_object('deleted_at', 'timestamp'), jsonb_build_object('deleted_at', NULL)
  );
  
  RETURN jsonb_build_object('success', true, 'record_id', record_id, 'table', table_name);
END;
$$;

-- Update SELECT policies to filter deleted records
DROP POLICY IF EXISTS jobs_select_consolidated ON jobs;
CREATE POLICY jobs_select_consolidated ON jobs FOR SELECT
USING (
  deleted_at IS NULL AND (
    user_has_org_hierarchy_access(organization_id) OR is_user_assigned_to_job(id)
  )
);

DROP POLICY IF EXISTS candidates_select_consolidated ON candidates;
CREATE POLICY candidates_select_consolidated ON candidates FOR SELECT
USING (
  deleted_at IS NULL AND (
    user_has_org_hierarchy_access(organization_id) OR
    EXISTS (
      SELECT 1 FROM job_candidate_associations jca
      WHERE jca.candidate_id = candidates.id AND is_user_assigned_to_job(jca.job_id)
    )
  )
);

DROP POLICY IF EXISTS job_postings_select_consolidated ON job_postings;
CREATE POLICY job_postings_select_consolidated ON job_postings FOR SELECT
USING (
  deleted_at IS NULL AND (
    is_active = true OR
    user_has_org_hierarchy_access((SELECT organization_id FROM jobs WHERE id = job_id))
  )
);

-- ==========================================
-- 3.5: Add FK ON DELETE Behavior
-- ==========================================

-- Scorecards cascade when association deleted
ALTER TABLE job_stage_scorecards DROP CONSTRAINT IF EXISTS job_stage_scorecards_association_id_fkey;
ALTER TABLE job_stage_scorecards ADD CONSTRAINT job_stage_scorecards_association_id_fkey
  FOREIGN KEY (association_id) REFERENCES job_candidate_associations(id) ON DELETE CASCADE;

-- Create trigger to cascade soft deletes to child records
CREATE OR REPLACE FUNCTION cascade_soft_delete_to_children()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'jobs' THEN
    -- Cascade to job_assignments
    UPDATE job_assignments 
    SET deleted_at = NEW.deleted_at, updated_at = now()
    WHERE job_id = NEW.id AND deleted_at IS NULL;
    
    -- Cascade to job_postings
    UPDATE job_postings
    SET deleted_at = NEW.deleted_at, updated_at = now()
    WHERE job_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_soft_delete_jobs ON jobs;
CREATE TRIGGER trg_cascade_soft_delete_jobs
AFTER UPDATE OF deleted_at ON jobs
FOR EACH ROW
WHEN (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
EXECUTE FUNCTION cascade_soft_delete_to_children();

-- Grant permissions
GRANT EXECUTE ON FUNCTION soft_delete_record TO authenticated;
GRANT EXECUTE ON FUNCTION admin_restore_record TO authenticated;
GRANT EXECUTE ON FUNCTION is_child_organization TO authenticated;