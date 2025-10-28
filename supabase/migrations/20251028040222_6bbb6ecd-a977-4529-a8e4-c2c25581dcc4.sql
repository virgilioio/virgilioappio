-- Consolidate all members to parent organizations only
-- This removes duplicate user-to-organization associations where users were in both parent and child orgs

DO $$
DECLARE
  parent_org_id uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  child_member_record RECORD;
BEGIN
  -- Loop through all members associated with child organizations
  FOR child_member_record IN 
    SELECT m.*, o.parent_organization_id
    FROM members m
    JOIN organizations o ON m.organization_id = o.id
    WHERE o.parent_organization_id IS NOT NULL
  LOOP
    -- Check if this user already has a membership in the parent org
    IF EXISTS (
      SELECT 1 FROM members 
      WHERE user_id = child_member_record.user_id 
      AND organization_id = parent_org_id
    ) THEN
      -- User already exists in parent org, delete the child org membership
      DELETE FROM members WHERE id = child_member_record.id;
    ELSE
      -- User doesn't exist in parent org, move them there
      UPDATE members 
      SET organization_id = parent_org_id
      WHERE id = child_member_record.id;
    END IF;
  END LOOP;
END $$;

-- Add constraint to prevent future child org member associations
-- Members can only be associated with organizations that have no parent (top-level orgs)
CREATE OR REPLACE FUNCTION check_member_org_is_parent()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = NEW.organization_id 
    AND parent_organization_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Members can only be associated with parent organizations, not child organizations';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce this on INSERT and UPDATE
DROP TRIGGER IF EXISTS enforce_parent_org_membership ON members;
CREATE TRIGGER enforce_parent_org_membership
  BEFORE INSERT OR UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION check_member_org_is_parent();