-- Comprehensive fix: Add search_path and qualify all names in activity logging functions

-- 1. Fix log_activity helper function
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id uuid,
  p_organization_id uuid,
  p_activity_type activity_type,
  p_title text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO public.activities (
    user_id,
    organization_id,
    activity_type,
    title,
    description,
    metadata,
    entity_type,
    entity_id
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_activity_type,
    p_title,
    p_description,
    p_metadata,
    p_entity_type,
    p_entity_id
  ) RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$function$;

-- 2. Fix log_candidate_created
CREATE OR REPLACE FUNCTION public.log_candidate_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM public.log_activity(
    p_user_id := COALESCE(NEW.created_by, auth.uid()),
    p_organization_id := NEW.organization_id,
    p_activity_type := 'candidate_created',
    p_title := 'Candidate added',
    p_description := 'Added ' || NEW.candidate_name || ' to the system',
    p_metadata := jsonb_build_object(
      'candidate_name', NEW.candidate_name,
      'email', NEW.email,
      'source', NEW.source,
      'candidate_id', NEW.id
    ),
    p_entity_type := 'candidate',
    p_entity_id := NEW.id
  );
  RETURN NEW;
END;
$function$;

-- 3. Fix log_candidate_updated
CREATE OR REPLACE FUNCTION public.log_candidate_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  changes jsonb := '{}'::jsonb;
BEGIN
  IF OLD.candidate_name IS DISTINCT FROM NEW.candidate_name THEN
    changes := changes || jsonb_build_object('name_changed', jsonb_build_object('from', OLD.candidate_name, 'to', NEW.candidate_name));
  END IF;
  
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    changes := changes || jsonb_build_object('email_changed', jsonb_build_object('from', OLD.email, 'to', NEW.email));
  END IF;
  
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    changes := changes || jsonb_build_object('status_changed', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  
  IF changes != '{}'::jsonb THEN
    PERFORM public.log_activity(
      p_user_id := auth.uid(),
      p_organization_id := NEW.organization_id,
      p_activity_type := 'candidate_updated',
      p_title := 'Candidate information updated',
      p_description := 'Updated information for ' || NEW.candidate_name,
      p_metadata := jsonb_build_object(
        'candidate_id', NEW.id,
        'candidate_name', NEW.candidate_name,
        'changes', changes
      ),
      p_entity_type := 'candidate',
      p_entity_id := NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Fix log_candidate_job_assignment
CREATE OR REPLACE FUNCTION public.log_candidate_job_assignment()
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
  SELECT candidate_name INTO v_candidate_name 
  FROM public.candidates 
  WHERE id = NEW.candidate_id;
  
  SELECT title, organization_id INTO v_job_title, v_organization_id
  FROM public.jobs 
  WHERE id = NEW.job_id;
  
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

-- 5. Fix log_candidate_stage_activity
CREATE OR REPLACE FUNCTION public.log_candidate_stage_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
  v_stage_name TEXT;
  v_organization_id UUID;
BEGIN
  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    SELECT candidate_name INTO v_candidate_name 
    FROM public.candidates 
    WHERE id = NEW.candidate_id;
    
    SELECT title, organization_id INTO v_job_title, v_organization_id
    FROM public.jobs 
    WHERE id = NEW.job_id;
    
    SELECT js.stage_name INTO v_stage_name
    FROM public.job_hiring_stages jhs
    JOIN public.job_stages js ON js.id = jhs.stage_id
    WHERE jhs.id = NEW.current_stage_id;
    
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

-- 6. Fix log_candidate_status_change
CREATE OR REPLACE FUNCTION public.log_candidate_status_change()
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
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT candidate_name INTO v_candidate_name 
    FROM public.candidates 
    WHERE id = NEW.candidate_id;
    
    SELECT title, organization_id INTO v_job_title, v_organization_id
    FROM public.jobs 
    WHERE id = NEW.job_id;
    
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

-- 7. Fix log_candidate_note_added
CREATE OR REPLACE FUNCTION public.log_candidate_note_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_candidate_name TEXT;
BEGIN
  SELECT candidate_name INTO v_candidate_name 
  FROM public.candidates 
  WHERE id = NEW.candidate_id;
  
  PERFORM public.log_activity(
    p_user_id := NEW.created_by,
    p_organization_id := NEW.organization_id,
    p_activity_type := 'note_added',
    p_title := 'Note added',
    p_description := 'Added a note for ' || v_candidate_name,
    p_metadata := jsonb_build_object(
      'candidate_id', NEW.candidate_id,
      'candidate_name', v_candidate_name,
      'note_id', NEW.id
    ),
    p_entity_type := 'candidate_comment',
    p_entity_id := NEW.id
  );
  
  RETURN NEW;
END;
$function$;

-- 8. Fix log_candidate_email_sent
CREATE OR REPLACE FUNCTION public.log_candidate_email_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_candidate_name TEXT;
BEGIN
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    SELECT candidate_name INTO v_candidate_name 
    FROM public.candidates 
    WHERE id = NEW.candidate_id;
    
    PERFORM public.log_activity(
      p_user_id := NEW.sent_by,
      p_organization_id := NEW.organization_id,
      p_activity_type := 'email_sent',
      p_title := 'Email sent',
      p_description := 'Sent email to ' || v_candidate_name || ': ' || NEW.subject,
      p_metadata := jsonb_build_object(
        'candidate_id', NEW.candidate_id,
        'candidate_name', v_candidate_name,
        'email_id', NEW.id,
        'subject', NEW.subject
      ),
      p_entity_type := 'email_log',
      p_entity_id := NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;