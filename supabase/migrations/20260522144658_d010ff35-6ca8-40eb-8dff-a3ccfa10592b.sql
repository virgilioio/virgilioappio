CREATE OR REPLACE FUNCTION public.tg_notify_interview_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      event_kind := NEW.status;
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
    SELECT NULLIF(TRIM(c.candidate_name), '')
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

  actor_name := COALESCE(cand_name, 'Candidate');
  actor_avatar := NULL;

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
END $function$;