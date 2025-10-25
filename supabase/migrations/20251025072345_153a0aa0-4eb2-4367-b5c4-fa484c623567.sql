-- Fix log_candidate_stage_activity to work with job_candidate_stage_history table
-- The function is triggered on INSERT to job_candidate_stage_history, not UPDATE to job_candidate_associations
-- So NEW refers to a job_candidate_stage_history record, which has different columns

CREATE OR REPLACE FUNCTION public.log_candidate_stage_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_candidate_id UUID;
  v_job_id UUID;
  v_candidate_name TEXT;
  v_job_title TEXT;
  v_stage_name TEXT;
  v_organization_id UUID;
BEGIN
  -- Get candidate_id and job_id from the association
  SELECT candidate_id, job_id
  INTO v_candidate_id, v_job_id
  FROM public.job_candidate_associations
  WHERE id = NEW.association_id;
  
  -- Get candidate name
  SELECT candidate_name INTO v_candidate_name 
  FROM public.candidates 
  WHERE id = v_candidate_id;
  
  -- Get job title and organization_id
  SELECT title, organization_id INTO v_job_title, v_organization_id
  FROM public.jobs 
  WHERE id = v_job_id;
  
  -- Get stage name from the to_stage_id (which is a job_hiring_stages.id)
  SELECT js.stage_name INTO v_stage_name
  FROM public.job_hiring_stages jhs
  JOIN public.job_stages js ON js.id = jhs.stage_id
  WHERE jhs.id = NEW.to_stage_id;
  
  -- Log the activity
  PERFORM public.log_activity(
    p_user_id := COALESCE(NEW.moved_by, auth.uid()),
    p_organization_id := v_organization_id,
    p_activity_type := 'candidate_stage_changed',
    p_title := 'Candidate moved to ' || COALESCE(v_stage_name, 'Application Review'),
    p_description := v_candidate_name || ' moved to ' || COALESCE(v_stage_name, 'Application Review') || ' in ' || v_job_title,
    p_metadata := jsonb_build_object(
      'candidate_id', v_candidate_id,
      'candidate_name', v_candidate_name,
      'job_id', v_job_id,
      'job_title', v_job_title,
      'from_stage_id', NEW.from_stage_id,
      'to_stage_id', NEW.to_stage_id,
      'stage_name', v_stage_name,
      'association_id', NEW.association_id
    ),
    p_entity_type := 'job_candidate_association',
    p_entity_id := NEW.association_id
  );
  
  RETURN NEW;
END;
$function$;