-- Migration: Add audit triggers for sensitive operations
-- Purpose: Log member role changes, offer letter status changes
-- Target events: member role updates, offer letter status updates

-- =====================================================
-- FUNCTION: Log audit event (for edge function usage)
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_table_name TEXT DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    p_action,
    p_table_name,
    p_record_id,
    p_user_id,
    p_old_values,
    p_new_values,
    now()
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- =====================================================
-- TRIGGER FUNCTION: Audit member role changes
-- =====================================================
CREATE OR REPLACE FUNCTION public.audit_member_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if role actually changed
  IF OLD.member_role IS DISTINCT FROM NEW.member_role THEN
    INSERT INTO public.audit_logs (
      action,
      table_name,
      record_id,
      user_id,
      old_values,
      new_values,
      created_at
    ) VALUES (
      'member_role_changed',
      'members',
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'member_role', OLD.member_role,
        'user_id', OLD.user_id,
        'organization_id', OLD.organization_id
      ),
      jsonb_build_object(
        'member_role', NEW.member_role,
        'user_id', NEW.user_id,
        'organization_id', NEW.organization_id
      ),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for member role changes
DROP TRIGGER IF EXISTS trigger_audit_member_role_change ON public.members;
CREATE TRIGGER trigger_audit_member_role_change
  AFTER UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_member_role_change();

-- =====================================================
-- TRIGGER FUNCTION: Audit offer letter status changes
-- =====================================================
CREATE OR REPLACE FUNCTION public.audit_offer_letter_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (
      action,
      table_name,
      record_id,
      user_id,
      old_values,
      new_values,
      created_at
    ) VALUES (
      'offer_letter_status_changed',
      'offer_letters',
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'status', OLD.status,
        'candidate_id', OLD.candidate_id,
        'job_id', OLD.job_id,
        'organization_id', OLD.organization_id
      ),
      jsonb_build_object(
        'status', NEW.status,
        'candidate_id', NEW.candidate_id,
        'job_id', NEW.job_id,
        'organization_id', NEW.organization_id
      ),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for offer letter status changes
DROP TRIGGER IF EXISTS trigger_audit_offer_letter_status_change ON public.offer_letters;
CREATE TRIGGER trigger_audit_offer_letter_status_change
  AFTER UPDATE ON public.offer_letters
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_offer_letter_status_change();

-- =====================================================
-- Add indexes for efficient audit log queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);