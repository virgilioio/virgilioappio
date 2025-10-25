-- Expand activity_type enum with candidate-specific types
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_created';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_updated';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_assigned_to_job';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_stage_changed';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_status_changed';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_note_added';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_email_sent';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_attachment_uploaded';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_profile_updated';

-- Create activity logging helper function
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_organization_id UUID,
  p_activity_type activity_type,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
) RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 1: Log candidate creation
CREATE OR REPLACE FUNCTION log_candidate_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_activity(
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_candidate_created ON public.candidates;
CREATE TRIGGER trg_log_candidate_created
AFTER INSERT ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION log_candidate_created();

-- Trigger 2: Log candidate profile updates
CREATE OR REPLACE FUNCTION log_candidate_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_changes JSONB := '{}'::jsonb;
  v_description TEXT;
BEGIN
  -- Track what changed
  IF OLD.candidate_name IS DISTINCT FROM NEW.candidate_name THEN
    v_changes := v_changes || jsonb_build_object('name_changed', jsonb_build_object('from', OLD.candidate_name, 'to', NEW.candidate_name));
  END IF;
  
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    v_changes := v_changes || jsonb_build_object('email_changed', jsonb_build_object('from', OLD.email, 'to', NEW.email));
  END IF;
  
  IF OLD.phone IS DISTINCT FROM NEW.phone THEN
    v_changes := v_changes || jsonb_build_object('phone_changed', jsonb_build_object('from', OLD.phone, 'to', NEW.phone));
  END IF;
  
  IF OLD.linkedin_url IS DISTINCT FROM NEW.linkedin_url THEN
    v_changes := v_changes || jsonb_build_object('linkedin_changed', jsonb_build_object('from', OLD.linkedin_url, 'to', NEW.linkedin_url));
  END IF;

  -- Only log if there were actual changes
  IF v_changes != '{}'::jsonb THEN
    v_description := 'Updated profile for ' || NEW.candidate_name;
    
    PERFORM log_activity(
      p_user_id := auth.uid(),
      p_organization_id := NEW.organization_id,
      p_activity_type := 'candidate_profile_updated',
      p_title := 'Profile updated',
      p_description := v_description,
      p_metadata := jsonb_build_object(
        'candidate_name', NEW.candidate_name,
        'candidate_id', NEW.id,
        'changes', v_changes
      ),
      p_entity_type := 'candidate',
      p_entity_id := NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_candidate_updated ON public.candidates;
CREATE TRIGGER trg_log_candidate_updated
AFTER UPDATE ON public.candidates
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION log_candidate_updated();

-- Trigger 3: Log job assignment
CREATE OR REPLACE FUNCTION log_candidate_job_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
BEGIN
  -- Get candidate name
  SELECT candidate_name INTO v_candidate_name
  FROM candidates WHERE id = NEW.candidate_id;
  
  -- Get job title
  SELECT title INTO v_job_title
  FROM jobs WHERE id = NEW.job_id;
  
  PERFORM log_activity(
    p_user_id := COALESCE(NEW.added_by, auth.uid()),
    p_organization_id := (SELECT organization_id FROM jobs WHERE id = NEW.job_id),
    p_activity_type := 'candidate_assigned_to_job',
    p_title := 'Assigned to job',
    p_description := 'Assigned ' || v_candidate_name || ' to ' || v_job_title,
    p_metadata := jsonb_build_object(
      'candidate_id', NEW.candidate_id,
      'candidate_name', v_candidate_name,
      'job_id', NEW.job_id,
      'job_title', v_job_title,
      'stage_id', NEW.current_stage_id
    ),
    p_entity_type := 'job_candidate_association',
    p_entity_id := NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_candidate_job_assignment ON public.job_candidate_associations;
CREATE TRIGGER trg_log_candidate_job_assignment
AFTER INSERT ON public.job_candidate_associations
FOR EACH ROW
EXECUTE FUNCTION log_candidate_job_assignment();

-- Trigger 4: Log stage changes
CREATE OR REPLACE FUNCTION log_candidate_stage_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_candidate_name TEXT;
  v_candidate_id UUID;
  v_job_title TEXT;
  v_job_id UUID;
  v_from_stage TEXT;
  v_to_stage TEXT;
  v_org_id UUID;
BEGIN
  -- Get candidate info
  SELECT c.candidate_name, c.id, jca.job_id INTO v_candidate_name, v_candidate_id, v_job_id
  FROM candidates c
  JOIN job_candidate_associations jca ON jca.candidate_id = c.id
  WHERE jca.id = NEW.association_id;
  
  -- Get job title and org
  SELECT j.title, j.organization_id INTO v_job_title, v_org_id
  FROM jobs j
  WHERE j.id = v_job_id;
  
  -- Get stage names
  SELECT name INTO v_from_stage FROM job_stages WHERE id = NEW.from_stage_id;
  SELECT name INTO v_to_stage FROM job_stages WHERE id = NEW.to_stage_id;
  
  PERFORM log_activity(
    p_user_id := NEW.moved_by,
    p_organization_id := v_org_id,
    p_activity_type := 'candidate_stage_changed',
    p_title := 'Stage changed',
    p_description := 'Moved ' || v_candidate_name || ' from ' || COALESCE(v_from_stage, 'no stage') || ' to ' || v_to_stage,
    p_metadata := jsonb_build_object(
      'candidate_id', v_candidate_id,
      'candidate_name', v_candidate_name,
      'job_id', v_job_id,
      'job_title', v_job_title,
      'from_stage', v_from_stage,
      'to_stage', v_to_stage,
      'note', NEW.note
    ),
    p_entity_type := 'stage_change',
    p_entity_id := NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_stage_activity ON public.job_candidate_stage_history;
CREATE TRIGGER trg_log_stage_activity
AFTER INSERT ON public.job_candidate_stage_history
FOR EACH ROW
EXECUTE FUNCTION log_candidate_stage_activity();

-- Trigger 5: Log status changes
CREATE OR REPLACE FUNCTION log_candidate_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_candidate_name TEXT;
  v_job_title TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get candidate name
    SELECT candidate_name INTO v_candidate_name
    FROM candidates WHERE id = NEW.candidate_id;
    
    -- Get job title
    SELECT title INTO v_job_title
    FROM jobs WHERE id = NEW.job_id;
    
    PERFORM log_activity(
      p_user_id := auth.uid(),
      p_organization_id := (SELECT organization_id FROM jobs WHERE id = NEW.job_id),
      p_activity_type := 'candidate_status_changed',
      p_title := 'Status changed',
      p_description := 'Changed status of ' || v_candidate_name || ' from ' || OLD.status || ' to ' || NEW.status,
      p_metadata := jsonb_build_object(
        'candidate_id', NEW.candidate_id,
        'candidate_name', v_candidate_name,
        'job_id', NEW.job_id,
        'job_title', v_job_title,
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      p_entity_type := 'job_candidate_association',
      p_entity_id := NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_candidate_status_change ON public.job_candidate_associations;
CREATE TRIGGER trg_log_candidate_status_change
AFTER UPDATE ON public.job_candidate_associations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_candidate_status_change();

-- Trigger 6: Log note added
CREATE OR REPLACE FUNCTION log_candidate_note_added()
RETURNS TRIGGER AS $$
DECLARE
  v_candidate_name TEXT;
  v_author_name TEXT;
BEGIN
  -- Get candidate name
  SELECT candidate_name INTO v_candidate_name
  FROM candidates WHERE id = NEW.candidate_id;
  
  -- Get author name from email
  v_author_name := SPLIT_PART(NEW.author_email, '@', 1);
  
  PERFORM log_activity(
    p_user_id := NEW.author_id,
    p_organization_id := NEW.organization_id,
    p_activity_type := 'candidate_note_added',
    p_title := 'Note added',
    p_description := v_author_name || ' added a note on ' || v_candidate_name,
    p_metadata := jsonb_build_object(
      'candidate_name', v_candidate_name,
      'candidate_id', NEW.candidate_id,
      'job_id', NEW.job_id,
      'comment_preview', LEFT(NEW.content, 100)
    ),
    p_entity_type := 'candidate_comment',
    p_entity_id := NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_candidate_note_added ON public.candidate_comments;
CREATE TRIGGER trg_log_candidate_note_added
AFTER INSERT ON public.candidate_comments
FOR EACH ROW
EXECUTE FUNCTION log_candidate_note_added();

-- Trigger 7: Log email sent
CREATE OR REPLACE FUNCTION log_candidate_email_sent()
RETURNS TRIGGER AS $$
DECLARE
  v_candidate_name TEXT;
BEGIN
  IF NEW.candidate_id IS NOT NULL AND NEW.status = 'sent' THEN
    -- Get candidate name
    SELECT candidate_name INTO v_candidate_name
    FROM candidates WHERE id = NEW.candidate_id;
    
    PERFORM log_activity(
      p_user_id := NEW.user_id,
      p_organization_id := NEW.organization_id,
      p_activity_type := 'candidate_email_sent',
      p_title := 'Email sent',
      p_description := 'Sent email to ' || v_candidate_name || ': ' || NEW.subject,
      p_metadata := jsonb_build_object(
        'candidate_name', v_candidate_name,
        'candidate_id', NEW.candidate_id,
        'job_id', NEW.job_id,
        'subject', NEW.subject,
        'to_addresses', NEW.to_addresses
      ),
      p_entity_type := 'email_log',
      p_entity_id := NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_candidate_email_sent ON public.email_logs;
CREATE TRIGGER trg_log_candidate_email_sent
AFTER INSERT OR UPDATE ON public.email_logs
FOR EACH ROW
WHEN (NEW.status = 'sent')
EXECUTE FUNCTION log_candidate_email_sent();