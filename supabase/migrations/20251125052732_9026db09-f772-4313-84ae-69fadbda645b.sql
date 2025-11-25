-- ==========================================
-- Migration: Add Activity Logging for Sourcing Projects and Missing Actions
-- ==========================================

-- ==========================================
-- Phase 1: Add Sourcing Project Activity Types
-- ==========================================
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'sourcing_project_created';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'sourcing_project_updated';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'sourcing_project_archived';

-- ==========================================
-- Phase 2: Add Scorecard Submission Activity Type
-- ==========================================
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'scorecard_submitted';

-- ==========================================
-- Phase 3: Add Attachment Upload Trigger
-- ==========================================

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

-- Create trigger for attachment uploads
DROP TRIGGER IF EXISTS trg_log_attachment_uploaded ON public.candidate_attachments;
CREATE TRIGGER trg_log_attachment_uploaded
AFTER INSERT ON public.candidate_attachments
FOR EACH ROW
EXECUTE FUNCTION public.log_candidate_attachment_uploaded();

-- ==========================================
-- Phase 4: Update log_activity() RPC to Accept tenant_id
-- ==========================================

CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_organization_id UUID,
  p_activity_type activity_type,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO public.activities (
    user_id,
    organization_id,
    tenant_id,
    activity_type,
    title,
    description,
    metadata,
    entity_type,
    entity_id
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_tenant_id,
    p_activity_type,
    p_title,
    p_description,
    p_metadata,
    p_entity_type,
    p_entity_id
  ) RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';