-- Fix check_onboarding_task_completion to use correct column names
CREATE OR REPLACE FUNCTION public.check_onboarding_task_completion(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  has_organization BOOLEAN := false;
  has_job BOOLEAN := false;
  has_candidate BOOLEAN := false;
  has_team BOOLEAN := false;
  has_google BOOLEAN := false;
  all_complete BOOLEAN := false;
  existing_progress public.onboarding_progress%ROWTYPE;
BEGIN
  -- Bypass RLS for this function
  SET LOCAL row_security = off;

  -- 1) Check for organization/department (organizations with org_kind = 'client' and matching tenant_id)
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.tenant_id = p_tenant_id
      AND o.org_kind = 'client'
  ) INTO has_organization;

  -- 2) Check for jobs (at least one job in this tenant)
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.tenant_id = p_tenant_id
  ) INTO has_job;

  -- 3) Check for candidates (via job_candidate_associations linked to jobs in this tenant)
  SELECT EXISTS (
    SELECT 1 FROM public.job_candidate_associations jca
    INNER JOIN public.jobs j ON j.id = jca.job_id
    WHERE j.tenant_id = p_tenant_id
  ) INTO has_candidate;

  -- 4) Check for team members (other members in this tenant, excluding the current user)
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id != p_user_id
      AND m.user_status = 'active'
  ) INTO has_team;

  -- 5) Google Workspace connected (Gmail provider in user_mail_identities)
  SELECT EXISTS (
    SELECT 1 FROM public.user_mail_identities umi
    WHERE umi.tenant_id = p_tenant_id
      AND umi.user_id = p_user_id
      AND umi.is_active = true
      AND umi.provider = 'gmail'
  ) INTO has_google;

  -- Determine if all tasks are complete
  all_complete := (has_organization AND has_job AND has_candidate AND has_team AND has_google);

  -- Fetch existing progress row
  SELECT * INTO existing_progress
  FROM public.onboarding_progress
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id;

  -- Upsert onboarding_progress with correct column names
  INSERT INTO public.onboarding_progress (
    user_id,
    tenant_id,
    task_organization_created,
    task_job_created,
    task_candidate_created,
    task_team_invited,
    task_google_connected,
    completed_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_tenant_id,
    has_organization,
    has_job,
    has_candidate,
    has_team,
    has_google,
    CASE WHEN all_complete THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET
    task_organization_created = CASE
      WHEN COALESCE(existing_progress.task_organization_manual, false) THEN existing_progress.task_organization_created
      ELSE EXCLUDED.task_organization_created
    END,
    task_job_created = CASE
      WHEN COALESCE(existing_progress.task_job_manual, false) THEN existing_progress.task_job_created
      ELSE EXCLUDED.task_job_created
    END,
    task_candidate_created = CASE
      WHEN COALESCE(existing_progress.task_candidate_manual, false) THEN existing_progress.task_candidate_created
      ELSE EXCLUDED.task_candidate_created
    END,
    task_team_invited = CASE
      WHEN COALESCE(existing_progress.task_team_manual, false) THEN existing_progress.task_team_invited
      ELSE EXCLUDED.task_team_invited
    END,
    task_google_connected = CASE
      WHEN COALESCE(existing_progress.task_google_manual, false) THEN existing_progress.task_google_connected
      ELSE EXCLUDED.task_google_connected
    END,
    completed_at = CASE
      WHEN all_complete THEN COALESCE(existing_progress.completed_at, NOW())
      ELSE NULL
    END,
    updated_at = NOW();
END;
$$;