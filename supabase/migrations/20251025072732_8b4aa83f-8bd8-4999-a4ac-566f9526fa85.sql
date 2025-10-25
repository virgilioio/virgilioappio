-- Fix log_candidate_note_added to use author_id instead of created_by
-- The candidate_comments table uses author_id, not created_by

CREATE OR REPLACE FUNCTION public.log_candidate_note_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
  v_organization_id UUID;
BEGIN
  -- Get candidate name
  SELECT candidate_name INTO v_candidate_name 
  FROM public.candidates 
  WHERE id = NEW.candidate_id;
  
  -- Get job title and organization_id
  SELECT title, organization_id INTO v_job_title, v_organization_id
  FROM public.jobs 
  WHERE id = NEW.job_id;
  
  -- Log the activity using author_id instead of created_by
  PERFORM public.log_activity(
    p_user_id := NEW.author_id,
    p_organization_id := v_organization_id,
    p_activity_type := 'candidate_note_added',
    p_title := 'Note added to candidate',
    p_description := 'Note added to ' || v_candidate_name || ' in ' || v_job_title,
    p_metadata := jsonb_build_object(
      'candidate_id', NEW.candidate_id,
      'candidate_name', v_candidate_name,
      'job_id', NEW.job_id,
      'job_title', v_job_title,
      'comment_id', NEW.id,
      'content_preview', LEFT(NEW.content, 100)
    ),
    p_entity_type := 'candidate_comment',
    p_entity_id := NEW.id
  );
  
  RETURN NEW;
END;
$function$;