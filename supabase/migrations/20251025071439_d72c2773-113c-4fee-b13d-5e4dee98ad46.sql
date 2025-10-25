-- Fix activity logging triggers to fetch organization_id from jobs table
-- The job_candidate_associations table doesn't have organization_id, so we need to fetch it from jobs

CREATE OR REPLACE FUNCTION public.log_candidate_job_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
  v_organization_id UUID;
BEGIN
  -- Fetch candidate name
  SELECT candidate_name INTO v_candidate_name 
  FROM public.candidates 
  WHERE id = NEW.candidate_id;
  
  -- Fetch job title and organization_id
  SELECT title, organization_id INTO v_job_title, v_organization_id
  FROM public.jobs 
  WHERE id = NEW.job_id;
  
  -- Log the activity
  PERFORM public.log_activity(
    p_user_id := COALESCE(NEW.created_by, auth.uid()),
    p_organization_id := v_organization_id,
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
    p_entity_type := 'job_candidate_association',
    p_entity_id := NEW.id
  );
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_candidate_stage_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
  v_stage_name TEXT;
  v_organization_id UUID;
BEGIN
  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    -- Fetch candidate name
    SELECT candidate_name INTO v_candidate_name 
    FROM public.candidates 
    WHERE id = NEW.candidate_id;
    
    -- Fetch job title and organization_id
    SELECT title, organization_id INTO v_job_title, v_organization_id
    FROM public.jobs 
    WHERE id = NEW.job_id;
    
    -- Fetch stage name
    SELECT js.stage_name INTO v_stage_name
    FROM public.job_hiring_stages jhs
    JOIN public.job_stages js ON js.id = jhs.stage_id
    WHERE jhs.id = NEW.current_stage_id;
    
    -- Log the activity
    PERFORM public.log_activity(
      p_user_id := auth.uid(),
      p_organization_id := v_organization_id,
      p_activity_type := 'candidate_stage_changed',
      p_title := 'Candidate moved to ' || COALESCE(v_stage_name, 'Application Review'),
      p_description := v_candidate_name || ' moved to ' || COALESCE(v_stage_name, 'Application Review') || ' in ' || v_job_title,
      p_metadata := jsonb_build_object(
        'candidate_id', NEW.candidate_id,
        'candidate_name', v_candidate_name,
        'job_id', NEW.job_id,
        'job_title', v_job_title,
        'from_stage_id', OLD.current_stage_id,
        'to_stage_id', NEW.current_stage_id,
        'stage_name', v_stage_name,
        'association_id', NEW.id
      ),
      p_entity_type := 'job_candidate_association',
      p_entity_id := NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_candidate_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
  v_organization_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Fetch candidate name
    SELECT candidate_name INTO v_candidate_name 
    FROM public.candidates 
    WHERE id = NEW.candidate_id;
    
    -- Fetch job title and organization_id
    SELECT title, organization_id INTO v_job_title, v_organization_id
    FROM public.jobs 
    WHERE id = NEW.job_id;
    
    -- Log the activity
    PERFORM public.log_activity(
      p_user_id := auth.uid(),
      p_organization_id := v_organization_id,
      p_activity_type := 'candidate_status_changed',
      p_title := 'Candidate status changed to ' || NEW.status,
      p_description := v_candidate_name || ' status changed from ' || OLD.status || ' to ' || NEW.status || ' in ' || v_job_title,
      p_metadata := jsonb_build_object(
        'candidate_id', NEW.candidate_id,
        'candidate_name', v_candidate_name,
        'job_id', NEW.job_id,
        'job_title', v_job_title,
        'from_status', OLD.status,
        'to_status', NEW.status,
        'association_id', NEW.id
      ),
      p_entity_type := 'job_candidate_association',
      p_entity_id := NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;