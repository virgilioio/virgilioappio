
-- Phase 1.6: Enforce chat posting flags + snapshot chat_mode on thread creation
CREATE OR REPLACE FUNCTION public.chat_threads_enforce_posting_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_enabled boolean;
  v_chat_mode text;
BEGIN
  -- Look up the posting attached to this job. Job may have 0 or 1 postings.
  SELECT chat_enabled, chat_mode
    INTO v_chat_enabled, v_chat_mode
  FROM public.job_postings
  WHERE job_id = NEW.job_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If a posting exists and chat is disabled, refuse thread creation.
  IF v_chat_enabled IS NOT NULL AND v_chat_enabled = false THEN
    RAISE EXCEPTION 'Candidate chat is disabled for this job posting'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Snapshot chat_mode onto the thread so later posting edits don't retroactively
  -- change conversation behaviour. Only snapshot when caller didn't set it explicitly
  -- (i.e. left the default).
  IF v_chat_mode IS NOT NULL AND (NEW.mode IS NULL OR NEW.mode = 'recruiter') THEN
    NEW.mode := v_chat_mode;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_threads_enforce_posting_settings ON public.chat_threads;
CREATE TRIGGER trg_chat_threads_enforce_posting_settings
  BEFORE INSERT ON public.chat_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.chat_threads_enforce_posting_settings();

-- Phase 1.6: Retention purge function. Soft-deletes threads (and their messages
-- cascade via partition retention later) older than the tenant's configured window
-- once the parent job has been closed/archived.
CREATE OR REPLACE FUNCTION public.purge_expired_chat_threads()
RETURNS TABLE(tenant_id uuid, purged_threads int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    WHERE j.status IN ('closed', 'archived', 'filled')
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
$$;

GRANT EXECUTE ON FUNCTION public.purge_expired_chat_threads() TO service_role;

COMMENT ON FUNCTION public.purge_expired_chat_threads() IS
  'Phase 1.6 retention: soft-archives chat_threads on jobs closed beyond tenant''s chat_retention_days_after_close. Run nightly via pg_cron / edge cron.';
