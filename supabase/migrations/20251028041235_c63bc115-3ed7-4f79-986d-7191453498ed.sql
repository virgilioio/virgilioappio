-- CORRECT MIGRATION: Consolidate members ONLY within Virgilio's organization hierarchy
-- This migration only affects organizations within the Virgilio tree and leaves all other SaaS customers untouched

DO $$
DECLARE
  virgilio_parent_id uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  child_member_record RECORD;
  virgilio_child_orgs uuid[];
BEGIN
  -- Get all child organizations in the Virgilio hierarchy only
  SELECT ARRAY_AGG(id) INTO virgilio_child_orgs
  FROM get_org_hierarchy(virgilio_parent_id)
  WHERE id != virgilio_parent_id;
  
  RAISE NOTICE 'Found % Virgilio child organizations to process', array_length(virgilio_child_orgs, 1);
  
  -- Loop through members associated with Virgilio's child organizations only
  FOR child_member_record IN 
    SELECT m.*, o.parent_organization_id
    FROM members m
    JOIN organizations o ON m.organization_id = o.id
    WHERE m.organization_id = ANY(virgilio_child_orgs)
  LOOP
    -- Check if this user already has a membership in the Virgilio parent org
    IF EXISTS (
      SELECT 1 FROM members 
      WHERE user_id = child_member_record.user_id 
      AND organization_id = virgilio_parent_id
    ) THEN
      -- User already exists in Virgilio parent org, delete the child org membership
      DELETE FROM members WHERE id = child_member_record.id;
      RAISE NOTICE 'Deleted duplicate membership for user % in child org', child_member_record.user_id;
    ELSE
      -- User doesn't exist in Virgilio parent org, move them there
      UPDATE members 
      SET organization_id = virgilio_parent_id
      WHERE id = child_member_record.id;
      RAISE NOTICE 'Moved user % to Virgilio parent org', child_member_record.user_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Virgilio-only member consolidation completed';
  
END $$;

-- Add Virgilio-scoped constraint to prevent future child org member associations
-- This ONLY applies to the Virgilio organization tree, leaving other SaaS customers untouched
CREATE OR REPLACE FUNCTION check_member_org_virgilio_constraint()
RETURNS TRIGGER AS $$
DECLARE
  virgilio_parent_id uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  is_virgilio_child boolean;
BEGIN
  -- Check if the organization is a child of Virgilio
  SELECT EXISTS (
    SELECT 1 
    FROM get_org_hierarchy(virgilio_parent_id)
    WHERE id = NEW.organization_id 
    AND id != virgilio_parent_id
  ) INTO is_virgilio_child;
  
  -- Only enforce the constraint for Virgilio's hierarchy
  IF is_virgilio_child THEN
    RAISE EXCEPTION 'Members in the Virgilio organization tree can only be associated with the parent Virgilio organization, not child organizations';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce this on INSERT and UPDATE
DROP TRIGGER IF EXISTS enforce_virgilio_parent_membership ON members;
CREATE TRIGGER enforce_virgilio_parent_membership
  BEFORE INSERT OR UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION check_member_org_virgilio_constraint();