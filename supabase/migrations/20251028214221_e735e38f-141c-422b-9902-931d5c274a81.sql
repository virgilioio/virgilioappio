-- Fix log_candidate_job_assignment trigger to use correct enum value
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
  SELECT candidate_name INTO v_candidate_name 
  FROM public.candidates 
  WHERE id = NEW.candidate_id;
  
  SELECT title, organization_id INTO v_job_title, v_organization_id
  FROM public.jobs 
  WHERE id = NEW.job_id;
  
  PERFORM public.log_activity(
    p_user_id := COALESCE(NEW.added_by, auth.uid()),
    p_organization_id := v_organization_id,
    p_activity_type := 'candidate_assigned_to_job',
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