
-- =====================================================
-- Notifications: tables, prefs, push subscriptions, RLS
-- =====================================================

-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.notification_category AS ENUM (
    'mention',
    'application_batch',
    'scorecard_submitted',
    'interview_event',
    'offer_event',
    'posting_status',
    'daily_digest'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID NOT NULL,
  category public.notification_category NOT NULL,
  actor_user_id UUID,
  actor_name TEXT,
  actor_avatar_url TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  preview TEXT,
  entity_kind TEXT,
  entity_id UUID,
  job_id UUID,
  candidate_id UUID,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created
  ON public.notifications (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category
  ON public.notifications (user_id, category, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own notifications" ON public.notifications;
CREATE POLICY "Users select own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Inserts only through SECURITY DEFINER trigger functions; no insert policy.

-- 3. notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY,
  mention_in_app BOOLEAN NOT NULL DEFAULT true,
  mention_email BOOLEAN NOT NULL DEFAULT true,
  mention_push BOOLEAN NOT NULL DEFAULT false,
  application_batch_in_app BOOLEAN NOT NULL DEFAULT true,
  application_batch_email BOOLEAN NOT NULL DEFAULT false,
  application_batch_push BOOLEAN NOT NULL DEFAULT false,
  scorecard_submitted_in_app BOOLEAN NOT NULL DEFAULT true,
  scorecard_submitted_email BOOLEAN NOT NULL DEFAULT false,
  scorecard_submitted_push BOOLEAN NOT NULL DEFAULT false,
  interview_event_in_app BOOLEAN NOT NULL DEFAULT true,
  interview_event_email BOOLEAN NOT NULL DEFAULT true,
  interview_event_push BOOLEAN NOT NULL DEFAULT false,
  offer_event_in_app BOOLEAN NOT NULL DEFAULT true,
  offer_event_email BOOLEAN NOT NULL DEFAULT true,
  offer_event_push BOOLEAN NOT NULL DEFAULT false,
  posting_status_in_app BOOLEAN NOT NULL DEFAULT true,
  posting_status_email BOOLEAN NOT NULL DEFAULT false,
  posting_status_push BOOLEAN NOT NULL DEFAULT false,
  daily_digest_in_app BOOLEAN NOT NULL DEFAULT false,
  daily_digest_email BOOLEAN NOT NULL DEFAULT false,
  daily_digest_push BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_tz TEXT DEFAULT 'UTC',
  sound_on_mention BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own prefs" ON public.notification_preferences;
CREATE POLICY "Users select own prefs" ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users upsert own prefs" ON public.notification_preferences;
CREATE POLICY "Users upsert own prefs" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own prefs" ON public.notification_preferences;
CREATE POLICY "Users update own prefs" ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subs" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subs" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. Helper: in_quiet_hours
CREATE OR REPLACE FUNCTION public.is_in_quiet_hours(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  now_local TIME;
BEGIN
  SELECT quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_tz
    INTO p FROM public.notification_preferences WHERE user_id = _user_id;
  IF p IS NULL OR NOT p.quiet_hours_enabled OR p.quiet_hours_start IS NULL OR p.quiet_hours_end IS NULL THEN
    RETURN FALSE;
  END IF;
  now_local := (now() AT TIME ZONE COALESCE(p.quiet_hours_tz, 'UTC'))::TIME;
  IF p.quiet_hours_start <= p.quiet_hours_end THEN
    RETURN now_local >= p.quiet_hours_start AND now_local < p.quiet_hours_end;
  ELSE
    RETURN now_local >= p.quiet_hours_start OR now_local < p.quiet_hours_end;
  END IF;
END $$;

-- 6. emit_notification helper
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
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;

  -- Ensure prefs row exists with defaults
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

  RETURN notif_id;
END $$;

-- 7. Trigger: mention in candidate_comments
-- Parse occurrences of @[Name](user:uuid) or bare uuid mentions ::user::<uuid>
CREATE OR REPLACE FUNCTION public.tg_notify_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uuid_text TEXT;
  recipient_id UUID;
  cand RECORD;
  job_title TEXT;
  actor_name TEXT;
  actor_avatar TEXT;
  tenant UUID;
  preview_text TEXT;
BEGIN
  SELECT c.id, c.first_name, c.last_name, c.tenant_id
    INTO cand FROM public.candidates c WHERE c.id = NEW.candidate_id;
  IF cand IS NULL THEN RETURN NEW; END IF;
  tenant := cand.tenant_id;

  SELECT j.title INTO job_title FROM public.jobs j WHERE j.id = NEW.job_id;

  SELECT COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), NEW.author_email, 'Someone'),
         p.avatar_url
    INTO actor_name, actor_avatar
    FROM public.profiles p WHERE p.user_id = NEW.author_id;
  IF actor_name IS NULL THEN actor_name := COALESCE(NEW.author_email, 'Someone'); END IF;

  preview_text := LEFT(REGEXP_REPLACE(NEW.content, '@\[[^\]]*\]\(user:[0-9a-f-]+\)', '@\1', 'g'), 280);

  FOR uuid_text IN
    SELECT DISTINCT (regexp_matches(NEW.content, '@\[[^\]]*\]\(user:([0-9a-f-]{36})\)', 'g'))[1]
  LOOP
    BEGIN
      recipient_id := uuid_text::UUID;
    EXCEPTION WHEN OTHERS THEN CONTINUE; END;
    IF recipient_id = NEW.author_id THEN CONTINUE; END IF;

    PERFORM public.emit_notification(
      recipient_id,
      tenant,
      'mention'::public.notification_category,
      NEW.author_id,
      actor_name,
      actor_avatar,
      actor_name || ' mentioned you in a comment on ' || COALESCE(TRIM(CONCAT(cand.first_name, ' ', cand.last_name)), 'a candidate'),
      COALESCE(job_title, '') ,
      preview_text,
      'candidate',
      NEW.candidate_id,
      NEW.job_id,
      NEW.candidate_id,
      '/candidates?openCandidate=' || NEW.candidate_id::text,
      jsonb_build_object('comment_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_mention ON public.candidate_comments;
CREATE TRIGGER notify_mention
  AFTER INSERT ON public.candidate_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_mention();

-- 8. Trigger: scorecard submitted (insert with rating)
CREATE OR REPLACE FUNCTION public.tg_notify_scorecard_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cand RECORD;
  job RECORD;
  actor_name TEXT;
  actor_avatar TEXT;
  recip UUID;
BEGIN
  IF NEW.rating IS NULL OR NEW.is_ai_draft IS TRUE THEN RETURN NEW; END IF;

  SELECT c.id, c.first_name, c.last_name, c.tenant_id
    INTO cand FROM public.candidates c WHERE c.id = NEW.candidate_id;
  SELECT j.id, j.title, j.created_by INTO job FROM public.jobs j WHERE j.id = NEW.job_id;

  SELECT COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), 'Someone'),
         p.avatar_url
    INTO actor_name, actor_avatar
    FROM public.profiles p WHERE p.user_id = NEW.created_by;

  -- Notify job creator (skip self)
  IF job.created_by IS NOT NULL AND job.created_by <> NEW.created_by THEN
    recip := job.created_by;
    PERFORM public.emit_notification(
      recip,
      cand.tenant_id,
      'scorecard_submitted'::public.notification_category,
      NEW.created_by,
      actor_name,
      actor_avatar,
      actor_name || ' submitted a scorecard for ' || COALESCE(TRIM(CONCAT(cand.first_name, ' ', cand.last_name)), 'a candidate'),
      COALESCE(job.title, ''),
      NULL,
      'candidate',
      NEW.candidate_id,
      NEW.job_id,
      NEW.candidate_id,
      '/candidates?openCandidate=' || NEW.candidate_id::text,
      jsonb_build_object('scorecard_id', NEW.id, 'rating', NEW.rating)
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_scorecard_submitted ON public.job_stage_scorecards;
CREATE TRIGGER notify_scorecard_submitted
  AFTER INSERT ON public.job_stage_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_scorecard_submitted();

-- 9. Trigger: interview events on scheduled_bookings
CREATE OR REPLACE FUNCTION public.tg_notify_interview_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_kind TEXT;
  cand_name TEXT;
  job_title TEXT;
  title_text TEXT;
  recip UUID;
  actor_name TEXT;
  actor_avatar TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_kind := 'scheduled';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      event_kind := NEW.status; -- 'cancelled', 'rescheduled', etc.
    ELSIF OLD.candidate_confirmation_status IS DISTINCT FROM NEW.candidate_confirmation_status
       AND NEW.candidate_confirmation_status = 'confirmed' THEN
      event_kind := 'confirmed';
    ELSIF OLD.candidate_confirmation_status IS DISTINCT FROM NEW.candidate_confirmation_status
       AND NEW.candidate_confirmation_status = 'declined' THEN
      event_kind := 'declined';
    ELSIF OLD.rescheduled_at IS DISTINCT FROM NEW.rescheduled_at AND NEW.rescheduled_at IS NOT NULL THEN
      event_kind := 'rescheduled';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  cand_name := NEW.candidate_name;
  IF NEW.candidate_id IS NOT NULL THEN
    SELECT NULLIF(TRIM(CONCAT(c.first_name, ' ', c.last_name)), '')
      INTO cand_name FROM public.candidates c WHERE c.id = NEW.candidate_id;
    IF cand_name IS NULL OR cand_name = '' THEN cand_name := NEW.candidate_name; END IF;
  END IF;

  SELECT j.title INTO job_title FROM public.jobs j WHERE j.id = NEW.job_id;

  title_text := COALESCE(cand_name, 'Candidate') || ' ' ||
    CASE event_kind
      WHEN 'confirmed' THEN 'confirmed their interview'
      WHEN 'declined' THEN 'declined their interview'
      WHEN 'rescheduled' THEN 'rescheduled their interview'
      WHEN 'cancelled' THEN 'cancelled their interview'
      WHEN 'scheduled' THEN 'has a new interview scheduled'
      ELSE 'interview updated'
    END;

  recip := NEW.booked_by;
  IF recip IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), NEW.candidate_name, 'Candidate'),
         p.avatar_url
    INTO actor_name, actor_avatar
    FROM public.profiles p WHERE p.user_id = NEW.candidate_id;
  IF actor_name IS NULL THEN actor_name := COALESCE(cand_name, 'Candidate'); END IF;

  PERFORM public.emit_notification(
    recip,
    NEW.tenant_id,
    'interview_event'::public.notification_category,
    NEW.candidate_id,
    actor_name,
    actor_avatar,
    title_text,
    COALESCE(job_title, '') || CASE WHEN NEW.scheduled_start IS NOT NULL THEN ' · ' || to_char(NEW.scheduled_start AT TIME ZONE 'UTC', 'Mon DD, HH24:MI') || ' UTC' ELSE '' END,
    NULL,
    'booking',
    NEW.id,
    NEW.job_id,
    NEW.candidate_id,
    CASE WHEN NEW.candidate_id IS NOT NULL THEN '/candidates?openCandidate=' || NEW.candidate_id::text ELSE NULL END,
    jsonb_build_object('event', event_kind, 'scheduled_start', NEW.scheduled_start, 'scheduled_end', NEW.scheduled_end)
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_interview_event ON public.scheduled_bookings;
CREATE TRIGGER notify_interview_event
  AFTER INSERT OR UPDATE ON public.scheduled_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_interview_event();

-- 10. Trigger: ensure default prefs row on first auth
CREATE OR REPLACE FUNCTION public.ensure_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ensure_prefs_on_profile ON public.profiles;
CREATE TRIGGER ensure_prefs_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_notification_preferences();
