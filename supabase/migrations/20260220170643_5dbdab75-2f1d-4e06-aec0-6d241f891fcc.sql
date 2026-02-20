
-- Add NULL guards to all unprotected activity-logging trigger functions
-- Mirrors the pattern already used in log_candidate_created (migration 20260220154610)

-- 1. log_candidate_job_assignment: fires on job_candidate_associations INSERT
CREATE OR REPLACE FUNCTION public.log_candidate_job_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_candidate_name text;
  v_job_title text;
  v_org_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Resolve user_id: prefer explicit column, fall back to JWT sub
  v_user_id := COALESCE(NEW.added_by, auth.uid());

  -- Guard: skip activity logging when there is no authenticated user
  -- (e.g. service-role inserts from public job applications)
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT candidate_name INTO v_candidate_name
    FROM candidates WHERE id = NEW.candidate_id;

  SELECT title, organization_id, tenant_id INTO v_job_title, v_org_id, v_tenant_id
    FROM jobs WHERE id = NEW.job_id;

  PERFORM log_activity(
    p_user_id        => v_user_id,
    p_organization_id => v_org_id,
    p_tenant_id      => v_tenant_id,
    p_activity_type  => 'candidate_added'::activity_type,
    p_title          => 'Candidate added to job',
    p_description    => v_candidate_name || ' was added to ' || COALESCE(v_job_title, 'a job'),
    p_metadata       => jsonb_build_object(
                          'candidate_id', NEW.candidate_id,
                          'job_id', NEW.job_id,
                          'candidate_name', v_candidate_name,
                          'job_title', v_job_title
                        ),
    p_entity_type    => 'candidate',
    p_entity_id      => NEW.candidate_id
  );

  RETURN NEW;
END;
$$;

-- 2. log_candidate_stage_activity: fires on job_candidate_associations UPDATE (stage change)
CREATE OR REPLACE FUNCTION public.log_candidate_stage_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_candidate_name text;
  v_job_title text;
  v_org_id uuid;
  v_tenant_id uuid;
  v_from_stage text;
  v_to_stage text;
BEGIN
  -- Only fire when the stage actually changed
  IF NEW.current_stage_id IS NOT DISTINCT FROM OLD.current_stage_id THEN
    RETURN NEW;
  END IF;

  -- Guard: skip when no authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT candidate_name INTO v_candidate_name
    FROM candidates WHERE id = NEW.candidate_id;

  SELECT title, organization_id, tenant_id INTO v_job_title, v_org_id, v_tenant_id
    FROM jobs WHERE id = NEW.job_id;

  SELECT js.stage_name INTO v_from_stage
    FROM job_hiring_stages jhs
    JOIN job_stages js ON js.id = jhs.stage_id
    WHERE jhs.id = OLD.current_stage_id;

  SELECT js.stage_name INTO v_to_stage
    FROM job_hiring_stages jhs
    JOIN job_stages js ON js.id = jhs.stage_id
    WHERE jhs.id = NEW.current_stage_id;

  PERFORM log_activity(
    p_user_id        => v_user_id,
    p_organization_id => v_org_id,
    p_tenant_id      => v_tenant_id,
    p_activity_type  => 'stage_changed'::activity_type,
    p_title          => 'Candidate stage changed',
    p_description    => v_candidate_name || ' moved from ' || COALESCE(v_from_stage, 'unknown') || ' to ' || COALESCE(v_to_stage, 'unknown'),
    p_metadata       => jsonb_build_object(
                          'candidate_id', NEW.candidate_id,
                          'job_id', NEW.job_id,
                          'candidate_name', v_candidate_name,
                          'job_title', v_job_title,
                          'from_stage', v_from_stage,
                          'to_stage', v_to_stage
                        ),
    p_entity_type    => 'candidate',
    p_entity_id      => NEW.candidate_id
  );

  RETURN NEW;
END;
$$;

-- 3. log_candidate_status_change: fires on job_candidate_associations UPDATE (status change)
CREATE OR REPLACE FUNCTION public.log_candidate_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_candidate_name text;
  v_job_title text;
  v_org_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Only fire when status actually changed
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Guard: skip when no authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT candidate_name INTO v_candidate_name
    FROM candidates WHERE id = NEW.candidate_id;

  SELECT title, organization_id, tenant_id INTO v_job_title, v_org_id, v_tenant_id
    FROM jobs WHERE id = NEW.job_id;

  PERFORM log_activity(
    p_user_id        => v_user_id,
    p_organization_id => v_org_id,
    p_tenant_id      => v_tenant_id,
    p_activity_type  => 'status_changed'::activity_type,
    p_title          => 'Candidate status changed',
    p_description    => v_candidate_name || ' status changed from ' || COALESCE(OLD.status, 'unknown') || ' to ' || COALESCE(NEW.status, 'unknown'),
    p_metadata       => jsonb_build_object(
                          'candidate_id', NEW.candidate_id,
                          'job_id', NEW.job_id,
                          'candidate_name', v_candidate_name,
                          'job_title', v_job_title,
                          'old_status', OLD.status,
                          'new_status', NEW.status
                        ),
    p_entity_type    => 'candidate',
    p_entity_id      => NEW.candidate_id
  );

  RETURN NEW;
END;
$$;

-- 4. log_candidate_updated: fires on candidates UPDATE
CREATE OR REPLACE FUNCTION public.log_candidate_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Guard: skip when no authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_org_id   := NEW.organization_id;
  v_tenant_id := NEW.tenant_id;

  PERFORM log_activity(
    p_user_id        => v_user_id,
    p_organization_id => v_org_id,
    p_tenant_id      => v_tenant_id,
    p_activity_type  => 'candidate_updated'::activity_type,
    p_title          => 'Candidate updated',
    p_description    => NEW.candidate_name || '''s profile was updated',
    p_metadata       => jsonb_build_object(
                          'candidate_id', NEW.id,
                          'candidate_name', NEW.candidate_name
                        ),
    p_entity_type    => 'candidate',
    p_entity_id      => NEW.id
  );

  RETURN NEW;
END;
$$;
