-- Update safe_delete_user function to remove billing_poc_user_id reference
CREATE OR REPLACE FUNCTION public.safe_delete_user(target_user_id uuid)
 RETURNS TABLE(success boolean, message text, affected_tables jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  affected_data jsonb := '{}';
BEGIN
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
$function$;

-- Now delete organization and all related data for test org
-- Organization ID: 888c14f2-366b-48a9-97d4-0ed9f1e94af9
-- User ID: 3f59e352-f2d8-4465-8b72-788c704d1505

-- Delete jobs (cascades will handle job_hiring_stages, job_candidate_associations, etc.)
DELETE FROM public.jobs WHERE organization_id = '888c14f2-366b-48a9-97d4-0ed9f1e94af9';

-- Delete email templates
DELETE FROM public.email_templates WHERE organization_id = '888c14f2-366b-48a9-97d4-0ed9f1e94af9';

-- Delete contract templates
DELETE FROM public.contract_templates WHERE organization_id = '888c14f2-366b-48a9-97d4-0ed9f1e94af9';

-- Delete offer templates
DELETE FROM public.offer_templates WHERE organization_id = '888c14f2-366b-48a9-97d4-0ed9f1e94af9';

-- Delete application fields
DELETE FROM public.application_fields WHERE organization_id = '888c14f2-366b-48a9-97d4-0ed9f1e94af9';

-- Delete job stages
DELETE FROM public.job_stages WHERE organization_id = '888c14f2-366b-48a9-97d4-0ed9f1e94af9';

-- Delete members
DELETE FROM public.members WHERE organization_id = '888c14f2-366b-48a9-97d4-0ed9f1e94af9';

-- Delete organization
DELETE FROM public.organizations WHERE id = '888c14f2-366b-48a9-97d4-0ed9f1e94af9';

-- Use the safe_delete_user function to clean up user data from public tables
SELECT * FROM public.safe_delete_user('3f59e352-f2d8-4465-8b72-788c704d1505');