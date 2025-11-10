-- =====================================================
-- Phase 2.5: Add RPC Function for Audit Log Retrieval
-- =====================================================

-- Function to query audit logs (platform admins only)
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  action text,
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'audit', 'public'
AS $$
BEGIN
  -- Verify caller is platform admin or workspace owner
  IF NOT public.is_platform_admin() AND NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins and workspace owners can view audit logs';
  END IF;
  
  -- Return audit logs
  RETURN QUERY
  SELECT 
    al.id,
    al.user_id,
    al.action,
    al.table_name,
    al.record_id,
    al.old_values,
    al.new_values,
    al.ip_address,
    al.user_agent,
    al.created_at
  FROM audit.audit_logs al
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.get_audit_logs IS 
  'Retrieve audit logs for platform admins and workspace owners. Returns recent audit events.';