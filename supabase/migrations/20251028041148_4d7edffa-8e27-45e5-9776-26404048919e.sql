-- EMERGENCY ROLLBACK: Restore incorrectly moved SaaS customers to their original organizations
-- This migration identifies and fixes members who were wrongly consolidated into Virgilio

DO $$
DECLARE
  affected_member RECORD;
  target_org_id uuid;
BEGIN
  -- Restore Allan Rodriguez to "Allan Bravo - Headhunting" parent org
  UPDATE members 
  SET organization_id = 'd7760c77-a936-4234-a673-5467f8d8fb39'
  WHERE user_id = '16d45189-3bba-4f7a-ba16-e6279b979af9'
    AND organization_id = '5ba7b145-f251-4b18-8900-724cb06028ab';
  
  RAISE NOTICE 'Restored Allan Rodriguez to his organization';

  -- Restore other non-Virgilio members to their correct parent organizations
  -- Loop through each affected member
  FOR affected_member IN
    SELECT DISTINCT 
      m.id as member_id,
      m.user_id,
      m.organization_id,
      u.email,
      u.raw_user_meta_data->>'signup_organization_id' as signup_org_id
    FROM members m
    JOIN auth.users u ON m.user_id = u.id
    WHERE m.organization_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
      AND u.email NOT LIKE '%@virgilio.tech'
      AND m.user_id != '16d45189-3bba-4f7a-ba16-e6279b979af9' -- Already handled Allan
  LOOP
    -- Try to find their original parent organization
    -- First check if signup_org_id exists and find its parent
    IF affected_member.signup_org_id IS NOT NULL THEN
      SELECT COALESCE(parent_organization_id, id) INTO target_org_id
      FROM organizations
      WHERE id = affected_member.signup_org_id::uuid;
      
      IF target_org_id IS NOT NULL THEN
        UPDATE members 
        SET organization_id = target_org_id
        WHERE id = affected_member.member_id;
        
        RAISE NOTICE 'Restored % to organization %', affected_member.email, target_org_id;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Emergency rollback completed';
  
END $$;

-- Drop the broken trigger and function that caused the issue
DROP TRIGGER IF EXISTS enforce_parent_org_membership ON members;
DROP FUNCTION IF EXISTS check_member_org_is_parent();