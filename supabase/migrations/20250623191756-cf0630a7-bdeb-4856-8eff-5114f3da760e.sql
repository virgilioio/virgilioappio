
-- Create an edge function to handle secure user deletion
-- This will be implemented as an edge function, but we need to ensure the billing POC constraint is handled

-- Add a function to safely delete a user and handle cascading effects
CREATE OR REPLACE FUNCTION public.safe_delete_user(target_user_id uuid)
RETURNS TABLE(success boolean, message text, affected_tables jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  billing_poc_orgs text[];
  affected_data jsonb := '{}';
BEGIN
  -- Check if user is referenced as billing POC in any organizations
  SELECT array_agg(name) INTO billing_poc_orgs
  FROM public.organizations 
  WHERE billing_poc_user_id = target_user_id;
  
  IF array_length(billing_poc_orgs, 1) > 0 THEN
    RETURN QUERY SELECT 
      false,
      'Cannot delete user: still assigned as billing POC for organizations: ' || array_to_string(billing_poc_orgs, ', '),
      jsonb_build_object('billing_poc_organizations', billing_poc_orgs);
    RETURN;
  END IF;
  
  -- Collect data that will be affected
  affected_data := jsonb_build_object(
    'profiles_deleted', (SELECT count(*) FROM public.profiles WHERE user_id = target_user_id),
    'members_deleted', (SELECT count(*) FROM public.members WHERE user_id = target_user_id),
    'activities_deleted', (SELECT count(*) FROM public.activities WHERE user_id = target_user_id),
    'job_assignments_deleted', (SELECT count(*) FROM public.job_assignments WHERE user_id = target_user_id)
  );
  
  -- Delete from all related tables (cascading will handle most of this)
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  DELETE FROM public.members WHERE user_id = target_user_id;
  DELETE FROM public.activities WHERE user_id = target_user_id;
  DELETE FROM public.job_assignments WHERE user_id = target_user_id;
  
  -- Return success
  RETURN QUERY SELECT 
    true,
    'User data successfully deleted from all public tables. Auth user must be deleted via admin API.',
    affected_data;
END;
$$;

-- Grant execution permission to authenticated users (will be restricted by RLS in the edge function)
GRANT EXECUTE ON FUNCTION public.safe_delete_user TO authenticated;
