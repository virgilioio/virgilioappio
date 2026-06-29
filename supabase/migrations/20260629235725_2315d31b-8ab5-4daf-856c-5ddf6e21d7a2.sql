-- Allow recruiters to insert their own audit rows.
GRANT INSERT ON public.chat_audit_log TO authenticated;

DROP POLICY IF EXISTS "Recruiters can write their own audit events" ON public.chat_audit_log;
CREATE POLICY "Recruiters can write their own audit events"
  ON public.chat_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_type = 'recruiter'
    AND actor_id = auth.uid()
    AND public.user_has_tenant_access(tenant_id)
  );
