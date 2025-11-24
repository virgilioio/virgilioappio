-- Fix check_onboarding_task_completion to use correct provider value for Gmail
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
  has_departments BOOLEAN := false;
  has_jobs BOOLEAN := false;
  has_candidates BOOLEAN := false;
  has_team BOOLEAN := false;
  has_google BOOLEAN := false;
  all_complete BOOLEAN := false;
  existing_progress RECORD;
BEGIN
  -- Bypass RLS for this function
  SET LOCAL row_security = off;

  -- 1) Check for departments (organizations with org_kind = 'client' and matching tenant_id)
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.tenant_id = p_tenant_id
      AND o.org_kind = 'client'
  ) INTO has_departments;

  -- 2) Check for jobs (at least one job in this tenant)
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.tenant_id = p_tenant_id
  ) INTO has_jobs;

  -- 3) Check for candidates (via job_candidate_associations linked to jobs in this tenant)
  SELECT EXISTS (
    SELECT 1 FROM public.job_candidate_associations jca
    INNER JOIN public.jobs j ON j.id = jca.job_id
    WHERE j.tenant_id = p_tenant_id
  ) INTO has_candidates;

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
  all_complete := (has_departments AND has_jobs AND has_candidates AND has_team AND has_google);

  -- Fetch existing progress row
  SELECT * INTO existing_progress
  FROM public.onboarding_progress
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id;

  -- Upsert onboarding_progress
  INSERT INTO public.onboarding_progress (
    user_id,
    tenant_id,
    task_departments_created,
    task_jobs_created,
    task_candidates_added,
    task_team_invited,
    task_google_connected,
    completed_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_tenant_id,
    has_departments,
    has_jobs,
    has_candidates,
    has_team,
    has_google,
    CASE WHEN all_complete THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET
    task_departments_created = CASE
      WHEN COALESCE(existing_progress.task_departments_manual, false) THEN existing_progress.task_departments_created
      ELSE EXCLUDED.task_departments_created
    END,
    task_jobs_created = CASE
      WHEN COALESCE(existing_progress.task_jobs_manual, false) THEN existing_progress.task_jobs_created
      ELSE EXCLUDED.task_jobs_created
    END,
    task_candidates_added = CASE
      WHEN COALESCE(existing_progress.task_candidates_manual, false) THEN existing_progress.task_candidates_added
      ELSE EXCLUDED.task_candidates_added
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