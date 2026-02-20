CREATE OR REPLACE FUNCTION public.log_candidate_attachment_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_candidate_name TEXT;
  v_organization_id UUID;
BEGIN
  -- Skip activity logging for unauthenticated/service-role operations
  -- (e.g., public job application submissions where uploaded_by is null)
  IF NEW.uploaded_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get candidate name and organization
  SELECT c.candidate_name, c.organization_id 
  INTO v_candidate_name, v_organization_id
  FROM public.candidates c 
  WHERE c.id = NEW.candidate_id;
  
  -- Log the activity
  PERFORM public.log_activity(
    p_user_id := NEW.uploaded_by,
    p_organization_id := v_organization_id,
    p_activity_type := 'candidate_attachment_uploaded',
    p_title := 'Document uploaded',
    p_description := 'Uploaded ' || NEW.file_name || COALESCE(' for ' || v_candidate_name, ''),
    p_metadata := jsonb_build_object(
      'candidate_name', v_candidate_name,
      'candidate_id', NEW.candidate_id,
      'file_name', NEW.file_name,
      'file_type', NEW.file_type,
      'is_resume', NEW.is_resume
    ),
    p_entity_type := 'candidate_attachment',
    p_entity_id := NEW.id
  );
  
  RETURN NEW;
END;
$$;