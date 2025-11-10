-- =====================================================
-- Phase 1.3: Make Audit Logs Immutable
-- =====================================================

-- Create dedicated audit schema
CREATE SCHEMA IF NOT EXISTS audit;

-- Create immutable audit logs table in audit schema
CREATE TABLE IF NOT EXISTS audit.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Migrate existing data from public.audit_logs if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO audit.audit_logs (id, user_id, action, table_name, record_id, old_values, new_values, created_at)
    SELECT id, user_id, action, table_name, record_id, old_values, new_values, created_at
    FROM public.audit_logs
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Enable RLS on audit logs
ALTER TABLE audit.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create function to prevent audit log tampering
CREATE OR REPLACE FUNCTION audit.prevent_audit_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted'
    USING ERRCODE = '23514',
          HINT = 'Audit logs are append-only for forensic integrity';
END;
$$;

-- Create trigger to block updates and deletes
DROP TRIGGER IF EXISTS audit_logs_immutable ON audit.audit_logs;
CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit.audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit.prevent_audit_tampering();

-- Platform admins can SELECT from audit logs
DROP POLICY IF EXISTS "audit_logs_platform_admin_select" ON audit.audit_logs;
CREATE POLICY "audit_logs_platform_admin_select"
ON audit.audit_logs FOR SELECT TO authenticated
USING (public.is_platform_admin());

-- Workspace owners can SELECT audit logs for their tenant only
DROP POLICY IF EXISTS "audit_logs_workspace_owner_select" ON audit.audit_logs;
CREATE POLICY "audit_logs_workspace_owner_select"
ON audit.audit_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
      AND (
        audit.audit_logs.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id::text = audit.audit_logs.record_id::text
            AND o.tenant_id = m.tenant_id
        )
      )
  )
);

-- Only authenticated users can INSERT audit logs
DROP POLICY IF EXISTS "audit_logs_insert_only" ON audit.audit_logs;
CREATE POLICY "audit_logs_insert_only"
ON audit.audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- Update log_audit_event function to write to audit schema
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_table_name text DEFAULT NULL,
  p_record_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'audit', 'public'
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO audit.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    COALESCE(p_user_id, auth.uid()),
    p_action,
    p_table_name,
    p_record_id,
    p_old_values,
    p_new_values,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent',
    now()
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit.audit_logs(created_at DESC);