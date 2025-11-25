-- Fix log_activity function ambiguity by dropping the old version without p_tenant_id parameter
-- This resolves the "function is not unique" error (42725) that was blocking pipeline moves and candidate rejections

DROP FUNCTION IF EXISTS public.log_activity(
  p_user_id uuid,
  p_organization_id uuid,
  p_activity_type activity_type,
  p_title text,
  p_description text,
  p_metadata jsonb,
  p_entity_type text,
  p_entity_id uuid
);