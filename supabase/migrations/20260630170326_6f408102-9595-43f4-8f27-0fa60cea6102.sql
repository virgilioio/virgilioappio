-- Phase 3 wrap-up hardening migration

-- 1) Candidate-visible message counter on chat_threads
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS candidate_visible_message_count integer NOT NULL DEFAULT 0;

-- Update touch trigger to also bump the candidate-visible counter when applicable.
CREATE OR REPLACE FUNCTION public.tg_chat_messages_touch_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_visible boolean;
BEGIN
  v_is_visible := (NEW.direction <> 'note')
                  AND (NEW.sender_type IN ('candidate','ai','recruiter'));

  UPDATE public.chat_threads
     SET last_message_at      = NEW.created_at,
         last_message_preview = left(coalesce(NEW.body, ''), 280),
         message_count        = message_count + 1,
         candidate_visible_message_count =
           candidate_visible_message_count + CASE WHEN v_is_visible THEN 1 ELSE 0 END,
         updated_at           = now()
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

-- Backfill candidate-visible counter for existing threads.
UPDATE public.chat_threads t
   SET candidate_visible_message_count = COALESCE(sub.cnt, 0)
  FROM (
    SELECT thread_id, count(*) AS cnt
      FROM public.chat_messages
     WHERE direction <> 'note'
       AND sender_type IN ('candidate','ai','recruiter')
     GROUP BY thread_id
  ) sub
 WHERE sub.thread_id = t.id;

-- 2) Refund RPC for AI token reserves (no clamping; never goes below 0).
CREATE OR REPLACE FUNCTION public.chat_refund_ai_tokens(
  p_tenant_id uuid,
  p_tokens    int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_amt   int  := GREATEST(p_tokens, 0);
BEGIN
  IF v_amt = 0 THEN RETURN; END IF;
  UPDATE public.chat_ai_token_usage
     SET tokens_used = GREATEST(tokens_used - v_amt, 0),
         updated_at  = now()
   WHERE tenant_id = p_tenant_id
     AND usage_date = v_today;
END $$;

REVOKE ALL ON FUNCTION public.chat_refund_ai_tokens(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.chat_refund_ai_tokens(uuid, int) TO service_role;