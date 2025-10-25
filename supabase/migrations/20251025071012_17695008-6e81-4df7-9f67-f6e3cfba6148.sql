-- Fix activity logging trigger functions with proper search path security

-- 1. Fix log_candidate_job_assignment trigger function
CREATE OR REPLACE FUNCTION public.log_candidate_job_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
BEGIN
  -- Get candidate name
  SELECT candidate_name INTO v_candidate_name
  FROM public.candidates
  WHERE id = NEW.candidate_id;
  
  -- Get job title
  SELECT title INTO v_job_title
  FROM public.jobs
  WHERE id = NEW.job_id;
  
  -- Log the assignment
  PERFORM public.log_activity(
    p_user_id := COALESCE(NEW.created_by, auth.uid()),
    p_organization_id := NEW.organization_id,
    p_activity_type := 'candidate_assigned',
    p_title := 'Candidate assigned to job',
    p_description := v_candidate_name || ' was assigned to ' || v_job_title,
    p_metadata := jsonb_build_object(
      'candidate_id', NEW.candidate_id,
      'candidate_name', v_candidate_name,
      'job_id', NEW.job_id,
      'job_title', v_job_title,
      'association_id', NEW.id
    ),
    p_entity_type := 'candidate',
    p_entity_id := NEW.candidate_id
  );
  
  RETURN NEW;
END;
$function$;

-- 2. Fix log_candidate_stage_activity trigger function
CREATE OR REPLACE FUNCTION public.log_candidate_stage_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
  v_old_stage_name TEXT;
  v_new_stage_name TEXT;
BEGIN
  -- Only log if stage actually changed
  IF OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id THEN
    -- Get candidate name
    SELECT c.candidate_name INTO v_candidate_name
    FROM public.candidates c
    JOIN public.job_candidate_associations jca ON jca.candidate_id = c.id
    WHERE jca.id = NEW.id;
    
    -- Get job title
    SELECT title INTO v_job_title
    FROM public.jobs
    WHERE id = NEW.job_id;
    
    -- Get old stage name if exists
    IF OLD.current_stage_id IS NOT NULL THEN
      SELECT stage_name INTO v_old_stage_name
      FROM public.job_stages js
      JOIN public.job_hiring_stages jhs ON jhs.stage_id = js.id
      WHERE jhs.id = OLD.current_stage_id;
    END IF;
    
    -- Get new stage name if exists
    IF NEW.current_stage_id IS NOT NULL THEN
      SELECT stage_name INTO v_new_stage_name
      FROM public.job_stages js
      JOIN public.job_hiring_stages jhs ON jhs.stage_id = js.id
      WHERE jhs.id = NEW.current_stage_id;
    END IF;
    
    -- Log the stage change
    PERFORM public.log_activity(
      p_user_id := auth.uid(),
      p_organization_id := NEW.organization_id,
      p_activity_type := 'candidate_stage_changed',
      p_title := 'Candidate moved to new stage',
      p_description := v_candidate_name || ' moved from ' || 
        COALESCE(v_old_stage_name, 'Application Review') || ' to ' || 
        COALESCE(v_new_stage_name, 'Application Review') || ' for ' || v_job_title,
      p_metadata := jsonb_build_object(
        'candidate_id', NEW.candidate_id,
        'candidate_name', v_candidate_name,
        'job_id', NEW.job_id,
        'job_title', v_job_title,
        'old_stage_id', OLD.current_stage_id,
        'old_stage_name', v_old_stage_name,
        'new_stage_id', NEW.current_stage_id,
        'new_stage_name', v_new_stage_name,
        'association_id', NEW.id
      ),
      p_entity_type := 'candidate',
      p_entity_id := NEW.candidate_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Fix log_candidate_status_change trigger function
CREATE OR REPLACE FUNCTION public.log_candidate_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get candidate name
    SELECT candidate_name INTO v_candidate_name
    FROM public.candidates
    WHERE id = NEW.candidate_id;
    
    -- Get job title
    SELECT title INTO v_job_title
    FROM public.jobs
    WHERE id = NEW.job_id;
    
    -- Log the status change
    PERFORM public.log_activity(
      p_user_id := COALESCE(auth.uid(), NEW.created_by),
      p_organization_id := NEW.organization_id,
      p_activity_type := 'candidate_status_changed',
      p_title := 'Candidate status updated',
      p_description := v_candidate_name || ' status changed from ' || 
        OLD.status || ' to ' || NEW.status || ' for ' || v_job_title,
      p_metadata := jsonb_build_object(
        'candidate_id', NEW.candidate_id,
        'candidate_name', v_candidate_name,
        'job_id', NEW.job_id,
        'job_title', v_job_title,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'association_id', NEW.id
      ),
      p_entity_type := 'candidate',
      p_entity_id := NEW.candidate_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;