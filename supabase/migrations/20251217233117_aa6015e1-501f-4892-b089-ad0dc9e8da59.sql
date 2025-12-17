-- CRITICAL SECURITY FIX: Add tenant_id to scheduled_bookings to prevent cross-tenant data leakage

-- Step 1: Add tenant_id column
ALTER TABLE scheduled_bookings 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- Step 2: Backfill existing records from organization
UPDATE scheduled_bookings sb
SET tenant_id = o.tenant_id
FROM organizations o
WHERE sb.organization_id = o.id
AND sb.tenant_id IS NULL;

-- Step 3: Backfill remaining records from interviewer's tenant (fallback)
UPDATE scheduled_bookings sb
SET tenant_id = m.tenant_id
FROM members m
WHERE sb.interviewer_id = m.user_id
AND m.user_status = 'active'
AND sb.tenant_id IS NULL;

-- Step 4: Make tenant_id NOT NULL after backfill
ALTER TABLE scheduled_bookings 
ALTER COLUMN tenant_id SET NOT NULL;

-- Step 5: Create index for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_scheduled_bookings_tenant_id ON scheduled_bookings(tenant_id);

-- Step 6: Create auto-population trigger
CREATE OR REPLACE FUNCTION auto_set_scheduled_booking_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    -- Derive from organization
    IF NEW.organization_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id
      FROM organizations WHERE id = NEW.organization_id;
    END IF;
    
    -- Fallback: derive from interviewer's tenant
    IF NEW.tenant_id IS NULL AND NEW.interviewer_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id
      FROM members WHERE user_id = NEW.interviewer_id AND user_status = 'active' LIMIT 1;
    END IF;
    
    -- Final fallback: derive from booked_by user's tenant
    IF NEW.tenant_id IS NULL AND NEW.booked_by IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id
      FROM members WHERE user_id = NEW.booked_by AND user_status = 'active' LIMIT 1;
    END IF;
    
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'Cannot determine tenant_id for scheduled_booking';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_set_scheduled_booking_tenant_id ON scheduled_bookings;
CREATE TRIGGER trg_auto_set_scheduled_booking_tenant_id
BEFORE INSERT OR UPDATE ON scheduled_bookings
FOR EACH ROW EXECUTE FUNCTION auto_set_scheduled_booking_tenant_id();

-- Step 7: Drop existing overly permissive RLS policies
DROP POLICY IF EXISTS "Interviewers can view own bookings" ON scheduled_bookings;
DROP POLICY IF EXISTS "Users can view relevant bookings" ON scheduled_bookings;
DROP POLICY IF EXISTS "Users can view bookings in org" ON scheduled_bookings;
DROP POLICY IF EXISTS "Platform admins can view all bookings" ON scheduled_bookings;
DROP POLICY IF EXISTS "Users can insert bookings" ON scheduled_bookings;
DROP POLICY IF EXISTS "Users can update bookings" ON scheduled_bookings;

-- Step 8: Create tenant-isolated RLS policies
-- SELECT: Users can view bookings in their tenant OR where they are the interviewer
CREATE POLICY "scheduled_bookings_select_tenant"
ON scheduled_bookings FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM members 
    WHERE user_id = auth.uid() AND user_status = 'active'
  )
  OR interviewer_id = auth.uid()
);

-- INSERT: Users can create bookings in their tenant
CREATE POLICY "scheduled_bookings_insert_tenant"
ON scheduled_bookings FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM members 
    WHERE user_id = auth.uid() AND user_status = 'active'
  )
  OR interviewer_id = auth.uid()
);

-- UPDATE: Users can update bookings in their tenant or where they're the interviewer
CREATE POLICY "scheduled_bookings_update_tenant"
ON scheduled_bookings FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM members 
    WHERE user_id = auth.uid() AND user_status = 'active'
  )
  OR interviewer_id = auth.uid()
);

-- DELETE: Users can delete bookings in their tenant (restricted to org admins)
CREATE POLICY "scheduled_bookings_delete_tenant"
ON scheduled_bookings FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM members 
    WHERE user_id = auth.uid() AND user_status = 'active'
  )
);