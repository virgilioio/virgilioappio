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
  cand_name TEXT;
  tenant UUID;
BEGIN
  IF NEW.rating IS NULL OR NEW.is_ai_draft IS TRUE THEN RETURN NEW; END IF;

  SELECT c.id, c.candidate_name, c.tenant_id, c.organization_id
    INTO cand FROM public.candidates c WHERE c.id = NEW.candidate_id;

  SELECT j.id, j.title, j.created_by INTO job FROM public.jobs j WHERE j.id = NEW.job_id;

  SELECT COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), 'Someone'),
         p.avatar_url
    INTO actor_name, actor_avatar
    FROM public.profiles p WHERE p.user_id = NEW.created_by;

  cand_name := COALESCE(NULLIF(TRIM(cand.candidate_name), ''), 'a candidate');
  tenant := COALESCE(cand.tenant_id, cand.organization_id);

  IF job.created_by IS NOT NULL AND job.created_by <> NEW.created_by THEN
    recip := job.created_by;
    PERFORM public.emit_notification(
      recip,
      tenant,
      'scorecard_submitted'::public.notification_category,
      NEW.created_by,
      actor_name,
      actor_avatar,
      actor_name || ' submitted a scorecard for ' || cand_name,
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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'tg_notify_scorecard_submitted failed: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END $$;