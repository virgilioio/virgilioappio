-- Broaden Gio Fit queueing: any stage on a job with a live client view.
CREATE OR REPLACE FUNCTION public.fit_queue_on_association()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ai_fit_analysis IS NOT NULL OR lower(coalesce(NEW.status,'')) IN ('rejected','withdrawn') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.current_stage_id IS NOT DISTINCT FROM OLD.current_stage_id THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM job_pipeline_shares ps WHERE ps.job_id = NEW.job_id AND ps.is_public) THEN
    INSERT INTO fit_analysis_queue (association_id) VALUES (NEW.id)
    ON CONFLICT (association_id) DO UPDATE SET status='pending', next_attempt_at=now(), updated_at=now()
      WHERE fit_analysis_queue.status IN ('failed');
    PERFORM fit_queue_wake();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fit_queue_on_association() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fit_queue_on_share()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT NEW.is_public THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_public AND NEW.visible_stage_ids IS NOT DISTINCT FROM OLD.visible_stage_ids THEN RETURN NEW; END IF;
  INSERT INTO fit_analysis_queue (association_id)
  SELECT a.id FROM job_candidate_associations a
  WHERE a.job_id = NEW.job_id AND a.ai_fit_analysis IS NULL
    AND lower(coalesce(a.status,'')) NOT IN ('rejected','withdrawn')
    AND a.current_stage_id IS NOT NULL
  ON CONFLICT (association_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN PERFORM fit_queue_wake(); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fit_queue_on_share() FROM PUBLIC, anon, authenticated;