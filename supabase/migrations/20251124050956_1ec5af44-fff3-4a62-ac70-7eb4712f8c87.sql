-- Fix onboarding progress computation to be tenant-scoped and remove legacy org_kind assumptions
CREATE OR REPLACE FUNCTION public.check_onboarding_task_completion(
  p_user_id uuid,
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row onboarding_progress%ROWTYPE;
  has_org boolean := false;
  has_job boolean := false;
  has_candidate boolean := false;
  has_team boolean := false;
  has_google boolean := false;
  all_complete boolean := false;
BEGIN
  -- Ensure we have a progress row for this (user, tenant)
  INSERT INTO public.onboarding_progress (user_id, tenant_id)
  VALUES (p_user_id, p_tenant_id)
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  -- Lock and load current row
  SELECT *
  INTO v_row
  FROM public.onboarding_progress
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- If for some reason the insert failed, just exit safely
    RETURN;
  END IF;

  -- 1) Department / Organization created (job folder within tenant)
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.tenant_id = p_tenant_id
      AND o.org_kind = 'client'
      AND o.status = 'active'
  ) INTO has_org;

  -- 2) Job created in this tenant
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.tenant_id = p_tenant_id
      AND (j.status IS NULL OR j.status != 'archived')
  ) INTO has_job;

  -- 3) Candidate added in this tenant
  -- Prefer tenant_id on candidates; fallback via job associations if needed
  SELECT EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE c.tenant_id = p_tenant_id
      AND c.deleted_at IS NULL
  ) INTO has_candidate;

  IF has_candidate IS NOT TRUE THEN
    -- Fallback: any candidate associated to a job in this tenant
    SELECT EXISTS (
      SELECT 1
      FROM public.job_candidate_associations jca
      JOIN public.candidates c ON c.id = jca.candidate_id
      JOIN public.jobs j ON j.id = jca.job_id
      WHERE j.tenant_id = p_tenant_id
        AND c.deleted_at IS NULL
    ) INTO has_candidate;
  END IF;

  -- 4) Team member invited (another active member in this tenant)
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_status = 'active'
      AND m.user_id IS NOT NULL
      AND m.user_id <> p_user_id
  ) INTO has_team;

  -- 5) Google Workspace connected (mail identity for this user & tenant)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_mail_identities umi
    WHERE umi.tenant_id = p_tenant_id
      AND umi.user_id = p_user_id
      AND umi.is_active = true
      AND umi.provider = 'google'
  ) INTO has_google;

  -- Update flags, but never override manual completions
  UPDATE public.onboarding_progress op
  SET
    task_organization_created = CASE
      WHEN op.task_organization_manual THEN op.task_organization_created
      ELSE op.task_organization_created OR has_org
    END,
    task_job_created = CASE
      WHEN op.task_job_manual THEN op.task_job_created
      ELSE op.task_job_created OR has_job
    END,
    task_candidate_created = CASE
      WHEN op.task_candidate_manual THEN op.task_candidate_created
      ELSE op.task_candidate_created OR has_candidate
    END,
    task_team_invited = CASE
      WHEN op.task_team_manual THEN op.task_team_invited
      ELSE op.task_team_invited OR has_team
    END,
    task_google_connected = CASE
      WHEN op.task_google_manual THEN op.task_google_connected
      ELSE op.task_google_connected OR has_google
    END,
    updated_at = now()
  WHERE op.user_id = p_user_id
    AND op.tenant_id = p_tenant_id
  RETURNING * INTO v_row;

  -- Recompute overall completion
  all_complete := coalesce(v_row.task_organization_created, false)
               AND coalesce(v_row.task_job_created, false)
               AND coalesce(v_row.task_candidate_created, false)
               AND coalesce(v_row.task_team_invited, false)
               AND coalesce(v_row.task_google_connected, false);

  IF all_complete AND v_row.completed_at IS NULL THEN
    UPDATE public.onboarding_progress
    SET completed_at = now()
    WHERE user_id = p_user_id
      AND tenant_id = p_tenant_id;
  END IF;

  RETURN;
END;
$function$;