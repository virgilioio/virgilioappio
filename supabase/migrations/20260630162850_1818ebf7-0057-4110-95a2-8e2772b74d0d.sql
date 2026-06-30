
-- Phase 3.2 — Gio AI reply infrastructure
-- 1. Per-thread soft lock to prevent concurrent AI replies racing.
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS ai_reply_lock_until timestamptz;

-- 2. Daily per-tenant token cap (configurable).
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS chat_ai_daily_token_cap integer NOT NULL DEFAULT 100000;

-- 3. Per-tenant per-day token usage counter.
CREATE TABLE IF NOT EXISTS public.chat_ai_token_usage (
  tenant_id  uuid NOT NULL,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  tokens_used bigint NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, usage_date)
);

GRANT SELECT ON public.chat_ai_token_usage TO authenticated;
GRANT ALL    ON public.chat_ai_token_usage TO service_role;

ALTER TABLE public.chat_ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read their AI token usage"
  ON public.chat_ai_token_usage FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- 4. Lease helper: returns true if the lease was taken (or extended by same lease window).
CREATE OR REPLACE FUNCTION public.chat_try_lock_thread_for_ai(
  p_thread_id uuid,
  p_seconds   int DEFAULT 30
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamptz := now();
  v_taken boolean := false;
BEGIN
  UPDATE public.chat_threads
     SET ai_reply_lock_until = v_now + make_interval(secs => p_seconds)
   WHERE id = p_thread_id
     AND (ai_reply_lock_until IS NULL OR ai_reply_lock_until < v_now)
  RETURNING true INTO v_taken;
  RETURN COALESCE(v_taken, false);
END $$;

GRANT EXECUTE ON FUNCTION public.chat_try_lock_thread_for_ai(uuid, int) TO service_role;

CREATE OR REPLACE FUNCTION public.chat_release_thread_ai_lock(p_thread_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.chat_threads SET ai_reply_lock_until = NULL WHERE id = p_thread_id;
$$;

GRANT EXECUTE ON FUNCTION public.chat_release_thread_ai_lock(uuid) TO service_role;

-- 5. Atomic token-cap consumer. Returns (allowed, tokens_after, cap).
CREATE OR REPLACE FUNCTION public.chat_consume_ai_tokens(
  p_tenant_id uuid,
  p_tokens    int
) RETURNS TABLE(allowed boolean, tokens_after bigint, cap integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cap    integer;
  v_after  bigint;
  v_today  date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  SELECT chat_ai_daily_token_cap INTO v_cap FROM public.tenants WHERE id = p_tenant_id;
  v_cap := COALESCE(v_cap, 100000);

  INSERT INTO public.chat_ai_token_usage(tenant_id, usage_date, tokens_used, request_count)
  VALUES (p_tenant_id, v_today, GREATEST(p_tokens,0), 1)
  ON CONFLICT (tenant_id, usage_date) DO UPDATE
    SET tokens_used   = public.chat_ai_token_usage.tokens_used + EXCLUDED.tokens_used,
        request_count = public.chat_ai_token_usage.request_count + 1,
        updated_at    = now()
  RETURNING public.chat_ai_token_usage.tokens_used INTO v_after;

  RETURN QUERY SELECT (v_after <= v_cap), v_after, v_cap;
END $$;

GRANT EXECUTE ON FUNCTION public.chat_consume_ai_tokens(uuid, int) TO service_role;
