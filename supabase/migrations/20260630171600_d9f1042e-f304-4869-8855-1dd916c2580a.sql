
-- ============================================================================
-- Phase 4.1 — chat_notification_queue
-- ============================================================================

-- 1) Enums
CREATE TYPE public.chat_notification_kind AS ENUM (
  'recruiter_new_message',
  'recruiter_handoff',
  'candidate_recruiter_reply'
);

CREATE TYPE public.chat_notification_status AS ENUM (
  'pending',
  'sent',
  'cancelled',
  'failed'
);

-- 2) Table
CREATE TABLE public.chat_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  kind public.chat_notification_kind NOT NULL,
  recipient_user_id uuid,
  recipient_email text,
  scheduled_for timestamptz NOT NULL,
  status public.chat_notification_status NOT NULL DEFAULT 'pending',
  message_count int NOT NULL DEFAULT 1,
  last_message_id uuid,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_notif_recipient_present CHECK (
    recipient_user_id IS NOT NULL OR recipient_email IS NOT NULL
  )
);

-- 3) GRANTs (tenant-scoped reads; only service_role writes)
GRANT SELECT ON public.chat_notification_queue TO authenticated;
GRANT ALL ON public.chat_notification_queue TO service_role;

-- 4) RLS
ALTER TABLE public.chat_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their tenant's chat notification queue"
  ON public.chat_notification_queue FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.user_status = 'active'
        AND m.tenant_id = chat_notification_queue.tenant_id
    )
  );

-- 5) Indexes
CREATE UNIQUE INDEX chat_notif_q_open_uidx
  ON public.chat_notification_queue (
    thread_id, kind, COALESCE(recipient_user_id::text, recipient_email)
  )
  WHERE status = 'pending';

CREATE INDEX chat_notif_q_due_idx
  ON public.chat_notification_queue (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX chat_notif_q_tenant_status_idx
  ON public.chat_notification_queue (tenant_id, status, created_at DESC);

-- 6) updated_at trigger
CREATE OR REPLACE FUNCTION public.set_chat_notif_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER chat_notif_q_set_updated_at
  BEFORE UPDATE ON public.chat_notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_chat_notif_updated_at();

-- 7) notification_preferences.chat_email_enabled
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS chat_email_enabled boolean NOT NULL DEFAULT true;

-- ============================================================================
-- 8) Enqueue helper (SECURITY DEFINER, coalescing)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.chat_notif_enqueue(
  p_tenant uuid,
  p_thread uuid,
  p_kind public.chat_notification_kind,
  p_user uuid,
  p_email text,
  p_message_id uuid DEFAULT NULL,
  p_throttle_seconds int DEFAULT 600,
  p_delay_seconds int DEFAULT 60
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_norm_email text := lower(NULLIF(trim(p_email), ''));
  v_existing_id uuid;
  v_new_id uuid;
  v_recent_sent timestamptz;
BEGIN
  IF p_user IS NULL AND v_norm_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Try to coalesce into an existing open row
  SELECT id INTO v_existing_id
  FROM public.chat_notification_queue
  WHERE thread_id = p_thread
    AND kind = p_kind
    AND status = 'pending'
    AND COALESCE(recipient_user_id::text, recipient_email) =
        COALESCE(p_user::text, v_norm_email)
  FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.chat_notification_queue
       SET message_count = message_count + 1,
           last_message_id = COALESCE(p_message_id, last_message_id),
           last_message_at = now()
     WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  -- Suppress if a sent row landed within the throttle window
  SELECT max(sent_at) INTO v_recent_sent
  FROM public.chat_notification_queue
  WHERE thread_id = p_thread
    AND kind = p_kind
    AND status = 'sent'
    AND COALESCE(recipient_user_id::text, recipient_email) =
        COALESCE(p_user::text, v_norm_email)
    AND sent_at > now() - make_interval(secs => p_throttle_seconds);

  IF v_recent_sent IS NOT NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.chat_notification_queue (
    tenant_id, thread_id, kind, recipient_user_id, recipient_email,
    scheduled_for, last_message_id
  ) VALUES (
    p_tenant, p_thread, p_kind, p_user, v_norm_email,
    now() + make_interval(secs => p_delay_seconds), p_message_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.chat_notif_enqueue(uuid,uuid,public.chat_notification_kind,uuid,text,uuid,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_notif_enqueue(uuid,uuid,public.chat_notification_kind,uuid,text,uuid,int,int) TO service_role;

-- ============================================================================
-- 9) Recruiter recipient resolver
-- ============================================================================
CREATE OR REPLACE FUNCTION public.chat_notif_recruiter_targets(p_thread uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid;
  v_assigned uuid;
BEGIN
  SELECT t.tenant_id, t.assigned_recruiter_id
    INTO v_tenant, v_assigned
  FROM public.chat_threads t WHERE t.id = p_thread;

  IF v_tenant IS NULL THEN RETURN; END IF;

  IF v_assigned IS NOT NULL THEN
    RETURN QUERY
      SELECT v_assigned
      WHERE COALESCE(
        (SELECT np.chat_email_enabled FROM public.notification_preferences np
          WHERE np.user_id = v_assigned),
        true
      ) = true;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT m.user_id
    FROM public.members m
    LEFT JOIN public.notification_preferences np ON np.user_id = m.user_id
    WHERE m.tenant_id = v_tenant
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.system_role IN ('admin','recruiter')
      )
      AND COALESCE(np.chat_email_enabled, true) = true;
END $$;

REVOKE ALL ON FUNCTION public.chat_notif_recruiter_targets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_notif_recruiter_targets(uuid) TO service_role;

-- ============================================================================
-- 10) Triggers on chat_messages
-- ============================================================================
CREATE OR REPLACE FUNCTION public.chat_messages_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target record;
  v_candidate_email text;
  v_last_seen timestamptz;
  v_suppressed boolean;
BEGIN
  -- Inbound from candidate -> enqueue recruiter_new_message per target
  IF NEW.direction = 'in' AND NEW.sender_type = 'candidate' THEN
    FOR v_target IN SELECT user_id FROM public.chat_notif_recruiter_targets(NEW.thread_id) LOOP
      PERFORM public.chat_notif_enqueue(
        NEW.tenant_id, NEW.thread_id, 'recruiter_new_message',
        v_target.user_id, NULL, NEW.id, 600, 60
      );
    END LOOP;
    RETURN NEW;
  END IF;

  -- Outbound from recruiter -> enqueue candidate email if not actively polling
  IF NEW.direction = 'out' AND NEW.sender_type = 'recruiter' THEN
    SELECT c.email, t.last_candidate_read_at
      INTO v_candidate_email, v_last_seen
    FROM public.chat_threads t
    JOIN public.candidates c ON c.id = t.candidate_id
    WHERE t.id = NEW.thread_id;

    IF v_candidate_email IS NULL THEN RETURN NEW; END IF;

    -- Skip if candidate polled within the last 2 minutes (likely live)
    IF v_last_seen IS NOT NULL AND v_last_seen > now() - interval '2 minutes' THEN
      RETURN NEW;
    END IF;

    -- Skip if email is on suppression list
    SELECT EXISTS(
      SELECT 1 FROM public.email_suppression_list
      WHERE lower(email) = lower(v_candidate_email)
    ) INTO v_suppressed;
    IF v_suppressed THEN RETURN NEW; END IF;

    PERFORM public.chat_notif_enqueue(
      NEW.tenant_id, NEW.thread_id, 'candidate_recruiter_reply',
      NULL, v_candidate_email, NEW.id, 600, 60
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER chat_messages_notify_aft
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_notify();

-- 11) Trigger on thread handoff
CREATE OR REPLACE FUNCTION public.chat_threads_notify_handoff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target record;
BEGIN
  IF NEW.status = 'awaiting_human'
     AND (OLD.status IS DISTINCT FROM 'awaiting_human') THEN
    FOR v_target IN SELECT user_id FROM public.chat_notif_recruiter_targets(NEW.id) LOOP
      PERFORM public.chat_notif_enqueue(
        NEW.tenant_id, NEW.id, 'recruiter_handoff',
        v_target.user_id, NULL, NULL, 600, 0
      );
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER chat_threads_notify_handoff_aft
  AFTER UPDATE OF status ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.chat_threads_notify_handoff();
