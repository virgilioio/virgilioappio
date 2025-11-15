-- Fix log_candidate_job_assignment function to use added_by column and handle NULL user_id
CREATE OR REPLACE FUNCTION public.log_candidate_job_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_candidate_name text;
  v_job_title text;
  v_org_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Get user_id from added_by column or auth.uid() as fallback
  v_user_id := COALESCE(NEW.added_by, auth.uid());
  
  -- Only log activity if we have a valid user_id
  IF v_user_id IS NOT NULL THEN
    -- Get candidate name
    SELECT candidate_name INTO v_candidate_name
    FROM public.candidates
    WHERE id = NEW.candidate_id;
    
    -- Get job title, org_id, and tenant_id
    SELECT title, organization_id, tenant_id INTO v_job_title, v_org_id, v_tenant_id
    FROM public.jobs
    WHERE id = NEW.job_id;
    
    -- Log the activity
    INSERT INTO public.activities (
      user_id,
      organization_id,
      tenant_id,
      activity_type,
      title,
      description,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      v_user_id,
      v_org_id,
      v_tenant_id,
      'candidate_added',
      'Candidate added to job',
      format('Added %s to %s', v_candidate_name, v_job_title),
      'job_candidate_association',
      NEW.id,
      jsonb_build_object(
        'candidate_id', NEW.candidate_id,
        'job_id', NEW.job_id,
        'stage_id', NEW.current_stage_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;