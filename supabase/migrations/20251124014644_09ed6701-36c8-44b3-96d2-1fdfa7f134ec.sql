-- Add Google Workspace connection tracking to onboarding_progress table
ALTER TABLE public.onboarding_progress
ADD COLUMN IF NOT EXISTS task_google_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS task_google_manual BOOLEAN DEFAULT FALSE;

-- Update the check_onboarding_task_completion function to include Google connection check
CREATE OR REPLACE FUNCTION public.check_onboarding_task_completion(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_progress_id UUID;
  v_profile_complete BOOLEAN;
  v_google_connected BOOLEAN;
  v_booking_configured BOOLEAN;
  v_organization_created BOOLEAN;
  v_job_created BOOLEAN;
  v_candidate_created BOOLEAN;
  v_team_invited BOOLEAN;
BEGIN
  -- Get or create onboarding_progress record
  SELECT id INTO v_progress_id
  FROM onboarding_progress
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
  
  IF v_progress_id IS NULL THEN
    INSERT INTO onboarding_progress (user_id, tenant_id)
    VALUES (p_user_id, p_tenant_id)
    RETURNING id INTO v_progress_id;
  END IF;

  -- Check profile completion
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE user_id = p_user_id 
    AND first_name IS NOT NULL 
    AND last_name IS NOT NULL
    AND title IS NOT NULL
    AND phone IS NOT NULL
    AND timezone IS NOT NULL
    AND linkedin_url IS NOT NULL
  ) INTO v_profile_complete;

  -- Check Google Workspace connection (either Gmail or Calendar)
  SELECT EXISTS(
    SELECT 1 FROM user_mail_identities
    WHERE user_id = p_user_id
  ) OR EXISTS(
    SELECT 1 FROM calendar_identities
    WHERE user_id = p_user_id
  ) INTO v_google_connected;

  -- Check booking configuration
  SELECT EXISTS(
    SELECT 1 FROM booking_configurations
    WHERE user_id = p_user_id
    AND is_active = true
  ) INTO v_booking_configured;

  -- Check organization creation
  SELECT EXISTS(
    SELECT 1 FROM organizations
    WHERE tenant_id = p_tenant_id
    AND org_kind = 'child'
  ) INTO v_organization_created;

  -- Check job creation
  SELECT EXISTS(
    SELECT 1 FROM jobs
    WHERE tenant_id = p_tenant_id
    AND deleted_at IS NULL
  ) INTO v_job_created;

  -- Check candidate creation
  SELECT EXISTS(
    SELECT 1 FROM candidates
    WHERE tenant_id = p_tenant_id
    AND deleted_at IS NULL
  ) INTO v_candidate_created;

  -- Check team invitation
  SELECT EXISTS(
    SELECT 1 FROM members
    WHERE tenant_id = p_tenant_id
    AND user_id != p_user_id
  ) INTO v_team_invited;

  -- Update onboarding_progress (preserve manual flags)
  UPDATE onboarding_progress
  SET
    task_profile_complete = CASE WHEN task_profile_manual THEN task_profile_complete ELSE v_profile_complete END,
    task_google_connected = CASE WHEN task_google_manual THEN task_google_connected ELSE v_google_connected END,
    task_booking_configured = CASE WHEN task_booking_manual THEN task_booking_configured ELSE v_booking_configured END,
    task_organization_created = CASE WHEN task_organization_manual THEN task_organization_created ELSE v_organization_created END,
    task_job_created = CASE WHEN task_job_manual THEN task_job_created ELSE v_job_created END,
    task_candidate_created = CASE WHEN task_candidate_manual THEN task_candidate_created ELSE v_candidate_created END,
    task_team_invited = CASE WHEN task_team_manual THEN task_team_invited ELSE v_team_invited END,
    completed_at = CASE 
      WHEN v_profile_complete 
        AND v_google_connected 
        AND v_booking_configured 
        AND v_organization_created 
        AND v_job_created 
        AND v_candidate_created 
        AND v_team_invited 
      THEN COALESCE(completed_at, NOW())
      ELSE NULL
    END
  WHERE id = v_progress_id;
END;
$$;