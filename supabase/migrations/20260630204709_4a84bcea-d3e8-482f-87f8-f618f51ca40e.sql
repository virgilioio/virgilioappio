CREATE OR REPLACE FUNCTION public.purge_expired_chat_threads()
 RETURNS TABLE(tenant_id uuid, purged_threads integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH per_tenant AS (
    SELECT t.id AS tenant_id,
           COALESCE(t.chat_retention_days_after_close, 90)::int AS days_after_close
    FROM public.tenants t
  ),
  closed_jobs AS (
    SELECT j.id AS job_id,
           j.tenant_id,
           COALESCE(j.updated_at, j.created_at) AS closed_at
    FROM public.jobs j
    WHERE j.status IN ('closed', 'archived')
  ),
  victims AS (
    SELECT ct.id, ct.tenant_id
    FROM public.chat_threads ct
    JOIN closed_jobs cj ON cj.job_id = ct.job_id
    JOIN per_tenant pt  ON pt.tenant_id = ct.tenant_id
    WHERE ct.deleted_at IS NULL
      AND cj.closed_at < now() - make_interval(days => pt.days_after_close)
  ),
  upd AS (
    UPDATE public.chat_threads ct
       SET deleted_at = now(),
           status = 'archived'
      FROM victims v
     WHERE ct.id = v.id
     RETURNING ct.tenant_id
  )
  SELECT u.tenant_id, COUNT(*)::int
  FROM upd u
  GROUP BY u.tenant_id;
END;
$function$;