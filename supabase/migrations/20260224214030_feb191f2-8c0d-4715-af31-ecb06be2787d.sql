
-- Fix incorrect enum values in trigger functions
-- 'status_changed' -> 'candidate_status_changed'
-- 'stage_changed' -> 'candidate_stage_changed'

CREATE OR REPLACE FUNCTION public.log_candidate_stage_change()
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
  IF NEW.current_stage_id IS NOT DISTINCT FROM OLD.current_stage_id THEN
    RETURN NEW;
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT candidate_name INTO v_candidate_name
    FROM candidates WHERE id = NEW.candidate_id;

  SELECT title, organization_id, tenant_id INTO v_job_title, v_org_id, v_tenant_id
    FROM jobs WHERE id = NEW.job_id;

  SELECT COALESCE(jhs.custom_stage_name, js.name) INTO v_from_stage
    FROM job_hiring_stages jhs
    JOIN job_stages js ON js.id = jhs.stage_id
    WHERE jhs.id = OLD.current_stage_id;

  SELECT COALESCE(jhs.custom_stage_name, js.name) INTO v_to_stage
    FROM job_hiring_stages jhs
    JOIN job_stages js ON js.id = jhs.stage_id
    WHERE jhs.id = NEW.current_stage_id;

  PERFORM log_activity(
    p_user_id        => v_user_id,
    p_organization_id => v_org_id,
    p_tenant_id      => v_tenant_id,
    p_activity_type  => 'candidate_stage_changed'::activity_type,
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
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

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
    p_activity_type  => 'candidate_status_changed'::activity_type,
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
