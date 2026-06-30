
-- H1: atomic rate limiter + unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_rate_limits_bucket
  ON public.chat_rate_limits (scope, scope_key, window_start);

DROP INDEX IF EXISTS public.idx_chat_rate_limits_lookup;
DROP INDEX IF EXISTS public.idx_chat_rate_limits_scope_window;

CREATE OR REPLACE FUNCTION public.chat_bump_rate_limit(
  p_scope text,
  p_scope_key text,
  p_window_seconds integer,
  p_max integer
)
RETURNS TABLE(allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.chat_rate_limits (scope, scope_key, window_start, count)
  VALUES (p_scope, p_scope_key, v_window_start, 1)
  ON CONFLICT (scope, scope_key, window_start)
  DO UPDATE SET count = public.chat_rate_limits.count + 1
  RETURNING public.chat_rate_limits.count INTO v_count;

  RETURN QUERY SELECT (v_count <= p_max), v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_bump_rate_limit(text, text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.chat_bump_rate_limit(text, text, integer, integer) TO service_role;

-- H3: retention sweep
CREATE OR REPLACE FUNCTION public.chat_retention_sweep()
RETURNS TABLE(rate_limits_deleted bigint, audit_deleted bigint, tokens_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rl bigint;
  v_audit bigint;
  v_tok bigint;
BEGIN
  WITH d AS (
    DELETE FROM public.chat_rate_limits
    WHERE window_start < now() - interval '2 days'
    RETURNING 1
  ) SELECT count(*) INTO v_rl FROM d;

  WITH d AS (
    DELETE FROM public.chat_audit_log
    WHERE created_at < now() - interval '180 days'
    RETURNING 1
  ) SELECT count(*) INTO v_audit FROM d;

  WITH d AS (
    DELETE FROM public.chat_access_tokens
    WHERE (revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days')
       OR (revoked_at IS NULL AND expires_at < now() - interval '30 days')
    RETURNING 1
  ) SELECT count(*) INTO v_tok FROM d;

  RETURN QUERY SELECT v_rl, v_audit, v_tok;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_retention_sweep() FROM public;
GRANT EXECUTE ON FUNCTION public.chat_retention_sweep() TO service_role;

-- Schedule daily at 03:10 UTC (existing chat-retention-purge-nightly runs at 03:15)
DO $$
BEGIN
  PERFORM cron.unschedule('chat-rate-and-audit-sweep');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'chat-rate-and-audit-sweep',
  '10 3 * * *',
  $$ SELECT public.chat_retention_sweep(); $$
);
