-- Phase 4.5: Migrate user_mail_identities and calendar_identities to use tenant_id

-- ==============================================================================
-- PART 1: Migrate user_mail_identities
-- ==============================================================================

-- Step 1: Drop policies that depend on organization_id
DROP POLICY IF EXISTS "user_mail_identities_platform_admin_select" ON user_mail_identities;
DROP POLICY IF EXISTS "user_mail_identities_platform_admin_update" ON user_mail_identities;
DROP POLICY IF EXISTS "user_mail_identities_platform_admin_delete" ON user_mail_identities;
DROP POLICY IF EXISTS "Users can delete own mail identities" ON user_mail_identities;
DROP POLICY IF EXISTS "Users can insert own mail identities" ON user_mail_identities;
DROP POLICY IF EXISTS "Users can update own mail identities" ON user_mail_identities;
DROP POLICY IF EXISTS "Users can view own mail identities" ON user_mail_identities;

-- Step 2: Add tenant_id column to user_mail_identities
ALTER TABLE user_mail_identities
ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 3: Populate tenant_id from members table
UPDATE user_mail_identities umi
SET tenant_id = m.tenant_id
FROM members m
WHERE m.user_id = umi.user_id
  AND m.user_status = 'active';

-- Step 4: Make tenant_id NOT NULL (all records should have tenant_id now)
ALTER TABLE user_mail_identities
ALTER COLUMN tenant_id SET NOT NULL;

-- Step 5: Drop organization_id column
ALTER TABLE user_mail_identities
DROP COLUMN organization_id;

-- Step 6: Create new RLS policies for user_mail_identities using tenant_id
CREATE POLICY "Users can view own mail identities"
ON user_mail_identities
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own mail identities"
ON user_mail_identities
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "Users can update own mail identities"
ON user_mail_identities
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own mail identities"
ON user_mail_identities
FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Platform admins can view all mail identities"
ON user_mail_identities
FOR SELECT
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can update all mail identities"
ON user_mail_identities
FOR UPDATE
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can delete all mail identities"
ON user_mail_identities
FOR DELETE
USING (get_user_type_secure() = 'platform_admin');

-- ==============================================================================
-- PART 2: Migrate calendar_identities
-- ==============================================================================

-- Step 1: Drop policies that depend on organization_id
DROP POLICY IF EXISTS "calendar_identities_platform_admin_select" ON calendar_identities;
DROP POLICY IF EXISTS "calendar_identities_platform_admin_update" ON calendar_identities;
DROP POLICY IF EXISTS "calendar_identities_platform_admin_delete" ON calendar_identities;
DROP POLICY IF EXISTS "Users can delete own calendar identities" ON calendar_identities;
DROP POLICY IF EXISTS "Users can insert own calendar identities" ON calendar_identities;
DROP POLICY IF EXISTS "Users can update own calendar identities" ON calendar_identities;
DROP POLICY IF EXISTS "Users can view own calendar identities" ON calendar_identities;

-- Step 2: Add tenant_id_new column to calendar_identities
ALTER TABLE calendar_identities
ADD COLUMN tenant_id_new uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 3: Populate tenant_id_new from members table
UPDATE calendar_identities ci
SET tenant_id_new = m.tenant_id
FROM members m
WHERE m.user_id = ci.user_id
  AND m.user_status = 'active';

-- Step 4: Make tenant_id_new NOT NULL
ALTER TABLE calendar_identities
ALTER COLUMN tenant_id_new SET NOT NULL;

-- Step 5: Drop organization_id column
ALTER TABLE calendar_identities
DROP COLUMN organization_id;

-- Step 6: Rename tenant_id_new to tenant_id
ALTER TABLE calendar_identities
RENAME COLUMN tenant_id_new TO tenant_id;

-- Step 7: Create new RLS policies for calendar_identities using tenant_id
CREATE POLICY "Users can view own calendar identities"
ON calendar_identities
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own calendar identities"
ON calendar_identities
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "Users can update own calendar identities"
ON calendar_identities
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own calendar identities"
ON calendar_identities
FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Platform admins can view all calendar identities"
ON calendar_identities
FOR SELECT
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can update all calendar identities"
ON calendar_identities
FOR UPDATE
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can delete all calendar identities"
ON calendar_identities
FOR DELETE
USING (get_user_type_secure() = 'platform_admin');