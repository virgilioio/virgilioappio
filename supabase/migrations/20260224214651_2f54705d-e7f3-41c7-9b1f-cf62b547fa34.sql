
-- Fix 1: Replace log_candidate_stage_change() to use correct column js.stage_name
CREATE OR REPLACE FUNCTION public.log_candidate_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
  v_from_stage TEXT;
  v_to_stage TEXT;
  v_org_id UUID;
  v_tenant_id UUID;
BEGIN
  IF OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id THEN
    SELECT c.candidate_name INTO v_candidate_name
    FROM public.candidates c WHERE c.id = NEW.candidate_id;

    SELECT j.title, j.organization_id, j.tenant_id
    INTO v_job_title, v_org_id, v_tenant_id
    FROM public.jobs j WHERE j.id = NEW.job_id;

    SELECT COALESCE(jhs.custom_stage_name, js.stage_name) INTO v_from_stage
    FROM public.job_hiring_stages jhs
    JOIN public.job_stages js ON js.id = jhs.stage_id
    WHERE jhs.id = OLD.current_stage_id;

    SELECT COALESCE(jhs.custom_stage_name, js.stage_name) INTO v_to_stage
    FROM public.job_hiring_stages jhs
    JOIN public.job_stages js ON js.id = jhs.stage_id
    WHERE jhs.id = NEW.current_stage_id;

    INSERT INTO public.activities (
      activity_type, title, description, entity_type, entity_id,
      user_id, organization_id, tenant_id, metadata
    ) VALUES (
      'candidate_stage_changed'::activity_type,
      v_candidate_name || ' moved to ' || COALESCE(v_to_stage, 'unknown'),
      'Stage changed from ' || COALESCE(v_from_stage, 'none') || ' to ' || COALESCE(v_to_stage, 'unknown') || ' for job ' || COALESCE(v_job_title, 'unknown'),
      'candidate',
      NEW.candidate_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
      v_org_id,
      v_tenant_id,
      jsonb_build_object(
        'job_id', NEW.job_id,
        'job_title', v_job_title,
        'from_stage', v_from_stage,
        'to_stage', v_to_stage,
        'association_id', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Fix 2: Drop orphan function
DROP FUNCTION IF EXISTS public.log_candidate_stage_activity() CASCADE;
