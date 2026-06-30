
-- 1. Tenant knobs
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS chat_inactivity_soft_delete_days int NOT NULL DEFAULT 30,
  ALTER COLUMN chat_hard_delete_days SET DEFAULT 90;

UPDATE public.tenants SET chat_hard_delete_days = 90 WHERE chat_hard_delete_days IS NULL;

-- 2. Soft delete: archive inactive open threads
CREATE OR REPLACE FUNCTION public.chat_soft_delete_inactive_threads()
RETURNS TABLE(tenant_id uuid, archived_threads int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH per_tenant AS (
    SELECT t.id AS tenant_id,
           GREATEST(COALESCE(t.chat_inactivity_soft_delete_days, 30), 1)::int AS days
    FROM public.tenants t
  ),
  victims AS (
    SELECT ct.id, ct.tenant_id
    FROM public.chat_threads ct
    JOIN per_tenant pt ON pt.tenant_id = ct.tenant_id
    WHERE ct.deleted_at IS NULL
      AND ct.status NOT IN ('archived')
      AND COALESCE(ct.last_message_at, ct.updated_at, ct.created_at)
          < now() - make_interval(days => pt.days)
  ),
  upd AS (
    UPDATE public.chat_threads ct
       SET deleted_at = now(),
           status = 'archived',
           updated_at = now()
      FROM victims v
     WHERE ct.id = v.id
     RETURNING ct.tenant_id
  )
  SELECT u.tenant_id, COUNT(*)::int
  FROM upd u
  GROUP BY u.tenant_id;
END;
$$;

-- 3. Hard delete: permanently remove threads soft-deleted past tenant window
CREATE OR REPLACE FUNCTION public.chat_hard_delete_threads()
RETURNS TABLE(tenant_id uuid, hard_deleted_threads int, hard_deleted_messages bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threads_deleted int := 0;
  v_messages_deleted bigint := 0;
BEGIN
  CREATE TEMP TABLE _victims ON COMMIT DROP AS
  SELECT ct.id, ct.tenant_id
  FROM public.chat_threads ct
  JOIN public.tenants t ON t.id = ct.tenant_id
  WHERE ct.deleted_at IS NOT NULL
    AND ct.deleted_at < now() - make_interval(
      days => GREATEST(COALESCE(t.chat_hard_delete_days, 90), 1)
    );

  -- Messages live in a partitioned table without FK, delete explicitly first
  WITH d AS (
    DELETE FROM public.chat_messages m
    USING _victims v
    WHERE m.thread_id = v.id
    RETURNING 1
  ) SELECT count(*) INTO v_messages_deleted FROM d;

  -- Audit rows reference thread_id loosely (no FK); clean them up too
  DELETE FROM public.chat_audit_log a
   USING _victims v
   WHERE a.thread_id = v.id;

  -- Threads: cascades to chat_thread_reads, chat_access_tokens, chat_notification_queue
  RETURN QUERY
  WITH d AS (
    DELETE FROM public.chat_threads ct
    USING _victims v
    WHERE ct.id = v.id
    RETURNING ct.tenant_id
  )
  SELECT d.tenant_id, COUNT(*)::int, v_messages_deleted
  FROM d
  GROUP BY d.tenant_id;
END;
$$;

-- 4. Drop fully expired message partitions
CREATE OR REPLACE FUNCTION public.chat_drop_expired_message_partitions(
  months_to_keep int DEFAULT 4
)
RETURNS TABLE(partition_name text, dropped boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  cutoff date;
  part_start date;
BEGIN
  cutoff := date_trunc('month', now())::date - make_interval(months => GREATEST(months_to_keep, 1));

  FOR r IN
    SELECT c.relname AS pname
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    WHERE i.inhparent = 'public.chat_messages'::regclass
      AND c.relname ~ '^chat_messages_\d{4}_\d{2}$'
  LOOP
    BEGIN
      part_start := to_date(substring(r.pname FROM 'chat_messages_(\d{4}_\d{2})$'), 'YYYY_MM');
    EXCEPTION WHEN OTHERS THEN
      part_start := NULL;
    END;

    IF part_start IS NOT NULL AND part_start < cutoff THEN
      EXECUTE format('DROP TABLE IF EXISTS public.%I', r.pname);
      partition_name := r.pname;
      dropped := true;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_soft_delete_inactive_threads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_hard_delete_threads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_drop_expired_message_partitions(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_soft_delete_inactive_threads() TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_hard_delete_threads() TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_drop_expired_message_partitions(int) TO service_role;
