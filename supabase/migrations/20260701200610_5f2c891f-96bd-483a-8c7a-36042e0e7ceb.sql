CREATE OR REPLACE FUNCTION public.chat_notif_recruiter_targets(p_thread uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_job uuid;
  v_assigned uuid;
BEGIN
  SELECT t.tenant_id, t.job_id, t.assigned_recruiter_id
    INTO v_tenant, v_job, v_assigned
  FROM public.chat_threads t
  WHERE t.id = p_thread;

  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  IF v_assigned IS NOT NULL THEN
    RETURN QUERY
      SELECT v_assigned
      WHERE COALESCE(
        (SELECT np.chat_email_enabled
         FROM public.notification_preferences np
         WHERE np.user_id = v_assigned),
        true
      ) = true;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT DISTINCT m.user_id
    FROM public.members m
    LEFT JOIN public.notification_preferences np ON np.user_id = m.user_id
    WHERE m.tenant_id = v_tenant
      AND m.user_status = 'active'
      AND COALESCE(np.chat_email_enabled, true) = true
      AND (
        m.user_type = 'workspace_owner'
        OR m.system_role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.job_assignments ja
          WHERE ja.user_id = m.user_id
            AND ja.job_id = v_job
            AND ja.role = 'recruiter'
            AND ja.deleted_at IS NULL
        )
      );
END
$function$;

GRANT EXECUTE ON FUNCTION public.chat_notif_recruiter_targets(uuid) TO authenticated, service_role;