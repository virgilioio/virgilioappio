-- =====================================================================
-- Phase 1.5 chat foundation hardening
-- =====================================================================

-- ---------- 1. Partition runway ----------
CREATE OR REPLACE FUNCTION public.create_chat_message_partitions(months_ahead int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_d date;
  end_d   date;
  pname   text;
  i       int;
BEGIN
  FOR i IN 0..months_ahead LOOP
    start_d := date_trunc('month', (now() + (i || ' months')::interval))::date;
    end_d   := (start_d + interval '1 month')::date;
    pname   := format('chat_messages_%s', to_char(start_d, 'YYYY_MM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.chat_messages FOR VALUES FROM (%L) TO (%L);',
      pname, start_d, end_d
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_chat_message_partitions(int) TO service_role;

-- Ensure pg_cron is available, then (re)schedule monthly partition creation.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('chat-messages-create-partitions');
EXCEPTION WHEN OTHERS THEN
  -- job did not exist yet, ignore
  NULL;
END $$;

SELECT cron.schedule(
  'chat-messages-create-partitions',
  '0 3 1 * *', -- 03:00 on the 1st of every month
  $$SELECT public.create_chat_message_partitions(3);$$
);

-- Top up immediately so we always have >=3 months runway from today.
SELECT public.create_chat_message_partitions(3);

-- ---------- 2. Maintain chat_threads.last_message_* + counter ----------
CREATE OR REPLACE FUNCTION public.tg_chat_messages_touch_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_threads
     SET last_message_at      = NEW.created_at,
         last_message_preview = left(coalesce(NEW.body, ''), 280),
         message_count        = message_count + 1,
         updated_at           = now()
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_touch_thread ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_touch_thread
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_messages_touch_thread();

-- Backfill existing rows so the conversation list is correct on first load.
UPDATE public.chat_threads t
   SET last_message_at      = sub.last_at,
       last_message_preview = left(coalesce(sub.last_body, ''), 280),
       message_count        = sub.cnt
  FROM (
    SELECT thread_id,
           max(created_at) AS last_at,
           count(*)        AS cnt,
           (array_agg(body ORDER BY created_at DESC))[1] AS last_body
      FROM public.chat_messages
     GROUP BY thread_id
  ) sub
 WHERE sub.thread_id = t.id;

-- ---------- 3. Per-recruiter read markers ----------
CREATE TABLE IF NOT EXISTS public.chat_thread_reads (
  thread_id     uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL,
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_thread_reads_user
  ON public.chat_thread_reads(user_id, tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_thread_reads TO authenticated;
GRANT ALL ON public.chat_thread_reads TO service_role;

ALTER TABLE public.chat_thread_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiters manage their own read markers" ON public.chat_thread_reads;
CREATE POLICY "Recruiters manage their own read markers"
  ON public.chat_thread_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_threads t
       WHERE t.id = chat_thread_reads.thread_id
         AND t.tenant_id = chat_thread_reads.tenant_id
         AND public.user_has_tenant_access(t.tenant_id)
    )
  );

-- ---------- 4. Kill switch enforced at DB level ----------
-- Blocks inbound candidate messages when tenants.chat_paused = true.
-- Recruiter sends and internal notes are intentionally still allowed so the
-- team can finish in-flight conversations after pausing.
CREATE OR REPLACE FUNCTION public.tg_chat_messages_enforce_kill_switch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paused boolean;
BEGIN
  IF NEW.direction = 'in' OR NEW.sender_type = 'candidate' THEN
    SELECT chat_paused INTO paused FROM public.tenants WHERE id = NEW.tenant_id;
    IF paused THEN
      RAISE EXCEPTION 'chat_paused: candidate chat is paused for this workspace'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_enforce_kill_switch ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_enforce_kill_switch
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_messages_enforce_kill_switch();
