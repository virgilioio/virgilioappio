-- Fix 1: Update Allan Rodriguez's profile to match his active membership
UPDATE profiles
SET organization_id = 'd7760c77-a936-4234-a673-5467f8d8fb39'
WHERE user_id = '16d45189-3bba-4f7a-ba16-e6279b979af9';

-- Fix 2: One-time migration to fix all users with mismatched profile<->member org IDs
WITH active_memberships AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    organization_id
  FROM members
  WHERE user_status = 'active'
  ORDER BY user_id, created_at DESC
)
UPDATE profiles p
SET organization_id = am.organization_id
FROM active_memberships am
WHERE p.user_id = am.user_id
  AND (p.organization_id IS NULL OR p.organization_id != am.organization_id);

-- Fix 3: Create function to auto-sync profile org_id with active membership
CREATE OR REPLACE FUNCTION sync_profile_organization()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  -- When a member record is inserted/updated to active, sync the profile
  IF NEW.user_status = 'active' THEN
    UPDATE profiles
    SET organization_id = NEW.organization_id,
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND (organization_id IS NULL OR organization_id != NEW.organization_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix 4: Create trigger on members table to auto-sync profiles
DROP TRIGGER IF EXISTS sync_profile_org_on_member_change ON members;
CREATE TRIGGER sync_profile_org_on_member_change
AFTER INSERT OR UPDATE OF organization_id, user_status ON members
FOR EACH ROW
EXECUTE FUNCTION sync_profile_organization();

-- Fix 5: Create diagnostic function for troubleshooting user auth issues
CREATE OR REPLACE FUNCTION diagnose_user_auth(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  check_name text,
  status text,
  details jsonb
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  -- Check 1: Profile organization
  RETURN QUERY
  SELECT 
    'Profile Organization'::text,
    CASE WHEN p.organization_id IS NULL THEN 'FAIL' ELSE 'PASS' END,
    jsonb_build_object(
      'profile_org_id', p.organization_id,
      'email', p.email
    )
  FROM profiles p
  WHERE p.user_id = target_user_id;
  
  -- Check 2: Active memberships
  RETURN QUERY
  SELECT 
    'Active Memberships'::text,
    CASE WHEN COUNT(*) = 0 THEN 'FAIL' ELSE 'PASS' END,
    jsonb_agg(jsonb_build_object(
      'organization_id', m.organization_id,
      'role', m.member_role,
      'org_name', o.name
    ))
  FROM members m
  JOIN organizations o ON o.id = m.organization_id
  WHERE m.user_id = target_user_id AND m.user_status = 'active'
  GROUP BY m.user_id;
  
  -- Check 3: Metadata vs Profile mismatch
  RETURN QUERY
  SELECT 
    'Metadata Consistency'::text,
    CASE 
      WHEN u.raw_user_meta_data->>'organization_id' = p.organization_id::text THEN 'PASS'
      WHEN p.organization_id IS NULL THEN 'WARN'
      ELSE 'FAIL'
    END,
    jsonb_build_object(
      'metadata_org', u.raw_user_meta_data->>'organization_id',
      'profile_org', p.organization_id,
      'mismatch', u.raw_user_meta_data->>'organization_id' != p.organization_id::text
    )
  FROM auth.users u
  JOIN profiles p ON p.user_id = u.id
  WHERE u.id = target_user_id;
END;
$$;