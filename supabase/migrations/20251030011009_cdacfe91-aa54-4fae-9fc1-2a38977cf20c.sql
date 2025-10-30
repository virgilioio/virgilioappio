-- Fix auto_assign_job_creator_to_assignments trigger function
-- This fixes the "type member_role does not exist" error during job INSERT operations

CREATE OR REPLACE FUNCTION public.auto_assign_job_creator_to_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only auto-assign if creator is a recruiter
  IF public.check_org_member_access(NEW.organization_id, 'recruiter'::public.member_role) THEN
    INSERT INTO public.job_assignments (
      job_id,
      user_id,
      organization_id,
      assigned_by
    ) VALUES (
      NEW.id,
      auth.uid(),
      NEW.organization_id,
      auth.uid()
    )
    ON CONFLICT (job_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.auto_assign_job_creator_to_assignments IS 'Auto-assigns job creator to job_assignments if they are a recruiter. Uses explicit public.member_role to prevent type resolution errors.';