
-- Ensure pg_net is available for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update emit_notification to dispatch a Web Push asynchronously after insert
CREATE OR REPLACE FUNCTION public.emit_notification(
  _user_id UUID,
  _tenant_id UUID,
  _category public.notification_category,
  _actor_user_id UUID,
  _actor_name TEXT,
  _actor_avatar_url TEXT,
  _title TEXT,
  _subtitle TEXT,
  _preview TEXT,
  _entity_kind TEXT,
  _entity_id UUID,
  _job_id UUID,
  _candidate_id UUID,
  _action_url TEXT,
  _metadata JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs RECORD;
  in_app BOOLEAN;
  notif_id UUID;
  service_key TEXT;
  func_url TEXT;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO prefs FROM public.notification_preferences WHERE user_id = _user_id;

  in_app := CASE _category
    WHEN 'mention' THEN prefs.mention_in_app
    WHEN 'application_batch' THEN prefs.application_batch_in_app
    WHEN 'scorecard_submitted' THEN prefs.scorecard_submitted_in_app
    WHEN 'interview_event' THEN prefs.interview_event_in_app
    WHEN 'offer_event' THEN prefs.offer_event_in_app
    WHEN 'posting_status' THEN prefs.posting_status_in_app
    WHEN 'daily_digest' THEN prefs.daily_digest_in_app
  END;

  IF NOT COALESCE(in_app, true) THEN RETURN NULL; END IF;

  INSERT INTO public.notifications (
    user_id, tenant_id, category, actor_user_id, actor_name, actor_avatar_url,
    title, subtitle, preview, entity_kind, entity_id, job_id, candidate_id,
    action_url, metadata
  ) VALUES (
    _user_id, _tenant_id, _category, _actor_user_id, _actor_name, _actor_avatar_url,
    _title, _subtitle, _preview, _entity_kind, _entity_id, _job_id, _candidate_id,
    _action_url, COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO notif_id;

  -- Fire-and-forget Web Push dispatch (respects per-category push pref inside the function)
  BEGIN
    service_key := current_setting('app.settings.service_role_key', true);
    func_url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/dispatch-push-notification';
    IF service_key IS NOT NULL AND service_key <> '' THEN
      PERFORM extensions.http_post(
        url := func_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('notification_id', notif_id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- never block the insert because of push dispatch issues
    NULL;
  END;

  RETURN notif_id;
END $$;
