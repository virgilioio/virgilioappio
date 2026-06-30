-- 1) Extend notification category enum
ALTER TYPE public.notification_category ADD VALUE IF NOT EXISTS 'chat_message';

-- 2) Add chat_message preference columns
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS chat_message_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_message_email  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS chat_message_push   boolean NOT NULL DEFAULT false;

-- 3) Bell enqueue helper with coalescing on (user, thread, kind)
CREATE OR REPLACE FUNCTION public.chat_bell_enqueue(
  p_tenant uuid,
  p_thread uuid,
  p_user uuid,
  p_kind text,                 -- 'new_message' | 'handoff'
  p_candidate_id uuid,
  p_title text,
  p_subtitle text,
  p_preview text,
  p_action_url text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pref_in_app boolean;
  v_existing_id uuid;
  v_existing_meta jsonb;
  v_new_count int;
  v_new_id uuid;
BEGIN
  IF p_user IS NULL OR p_thread IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT CASE p_kind
           WHEN 'handoff' THEN COALESCE(np.chat_message_in_app, true)
           ELSE COALESCE(np.chat_message_in_app, true)
         END
    INTO v_pref_in_app
  FROM public.notification_preferences np
  WHERE np.user_id = p_user;

  IF v_pref_in_app IS NULL THEN v_pref_in_app := true; END IF;
  IF NOT v_pref_in_app THEN RETURN NULL; END IF;

  -- Coalesce: find latest UNREAD bell entry for this (user, thread, kind)
  SELECT id, metadata
    INTO v_existing_id, v_existing_meta
  FROM public.notifications
  WHERE user_id = p_user
    AND category = 'chat_message'
    AND read_at IS NULL
    AND metadata->>'thread_id' = p_thread::text
    AND metadata->>'kind' = p_kind
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    v_new_count := COALESCE((v_existing_meta->>'message_count')::int, 1) + 1;
    UPDATE public.notifications
       SET title    = p_title,
           subtitle = p_subtitle,
           preview  = p_preview,
           action_url = p_action_url,
           metadata = COALESCE(v_existing_meta, '{}'::jsonb)
                      || jsonb_build_object(
                           'message_count', v_new_count,
                           'last_at', to_jsonb(now())
                         ),
           created_at = now()
     WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.notifications (
    tenant_id, user_id, category, title, subtitle, preview,
    entity_kind, entity_id, candidate_id, action_url, metadata
  ) VALUES (
    p_tenant, p_user, 'chat_message', p_title, p_subtitle, p_preview,
    'chat_thread', p_thread, p_candidate_id, p_action_url,
    jsonb_build_object(
      'thread_id', p_thread,
      'kind', p_kind,
      'message_count', 1,
      'last_at', to_jsonb(now())
    )
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

-- 4) Update chat_messages_notify to also write bell entries
CREATE OR REPLACE FUNCTION public.chat_messages_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target record;
  v_candidate_email text;
  v_candidate_id uuid;
  v_candidate_name text;
  v_last_seen timestamptz;
  v_suppressed boolean;
  v_preview text;
  v_title text;
  v_action_url text;
BEGIN
  -- Inbound from candidate -> recruiter bell + email
  IF NEW.direction = 'in' AND NEW.sender_type = 'candidate' THEN
    SELECT t.candidate_id, c.candidate_name
      INTO v_candidate_id, v_candidate_name
    FROM public.chat_threads t
    LEFT JOIN public.candidates c ON c.id = t.candidate_id
    WHERE t.id = NEW.thread_id;

    v_preview := left(COALESCE(NEW.body, ''), 140);
    v_title := COALESCE(v_candidate_name, 'Candidate') || ' sent a new message';
    v_action_url := '/chat/' || NEW.thread_id::text;

    FOR v_target IN SELECT user_id FROM public.chat_notif_recruiter_targets(NEW.thread_id) LOOP
      PERFORM public.chat_notif_enqueue(
        NEW.tenant_id, NEW.thread_id, 'recruiter_new_message',
        v_target.user_id, NULL, NEW.id, 600, 60
      );
      PERFORM public.chat_bell_enqueue(
        NEW.tenant_id, NEW.thread_id, v_target.user_id,
        'new_message', v_candidate_id,
        v_title, NULL, v_preview, v_action_url
      );
    END LOOP;
    RETURN NEW;
  END IF;

  -- Outbound from recruiter -> candidate email path (unchanged)
  IF NEW.direction = 'out' AND NEW.sender_type = 'recruiter' THEN
    SELECT c.email, t.last_candidate_read_at
      INTO v_candidate_email, v_last_seen
    FROM public.chat_threads t
    JOIN public.candidates c ON c.id = t.candidate_id
    WHERE t.id = NEW.thread_id;

    IF v_candidate_email IS NULL THEN RETURN NEW; END IF;

    IF v_last_seen IS NOT NULL AND v_last_seen > now() - interval '2 minutes' THEN
      RETURN NEW;
    END IF;

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

-- 5) Update handoff trigger to also write bell entries
CREATE OR REPLACE FUNCTION public.chat_threads_notify_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target record;
  v_candidate_name text;
  v_title text;
  v_action_url text;
BEGIN
  IF NEW.status = 'awaiting_human'
     AND (OLD.status IS DISTINCT FROM 'awaiting_human') THEN

    SELECT c.candidate_name INTO v_candidate_name
    FROM public.candidates c WHERE c.id = NEW.candidate_id;

    v_title := 'Gio handed off ' || COALESCE(v_candidate_name, 'a candidate') || ' — needs a human';
    v_action_url := '/chat/' || NEW.id::text;

    FOR v_target IN SELECT user_id FROM public.chat_notif_recruiter_targets(NEW.id) LOOP
      PERFORM public.chat_notif_enqueue(
        NEW.tenant_id, NEW.id, 'recruiter_handoff',
        v_target.user_id, NULL, NULL, 600, 0
      );
      PERFORM public.chat_bell_enqueue(
        NEW.tenant_id, NEW.id, v_target.user_id,
        'handoff', NEW.candidate_id,
        v_title, NULL, NULL, v_action_url
      );
    END LOOP;
  END IF;
  RETURN NEW;
END $$;