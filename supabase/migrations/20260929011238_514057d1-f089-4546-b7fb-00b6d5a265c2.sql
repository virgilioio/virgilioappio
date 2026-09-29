CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.fit_analysis_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL UNIQUE REFERENCES public.job_candidate_associations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fit_analysis_queue TO service_role;
ALTER TABLE public.fit_analysis_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX fit_analysis_queue_pending_idx ON public.fit_analysis_queue (status, next_attempt_at);

CREATE TABLE public.fit_analysis_queue_control (
  id int PRIMARY KEY DEFAULT 1,
  lease_until timestamptz,
  paused_reason text,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fit_analysis_queue_control TO service_role;
ALTER TABLE public.fit_analysis_queue_control ENABLE ROW LEVEL SECURITY;
INSERT INTO public.fit_analysis_queue_control (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Lease: returns true if this caller now owns the single-flight lock.
CREATE OR REPLACE FUNCTION public.fit_queue_acquire_lease(_seconds int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  UPDATE fit_analysis_queue_control SET lease_until = now() + make_interval(secs => _seconds), updated_at = now()
  WHERE id = 1 AND paused_reason IS NULL AND (lease_until IS NULL OR lease_until < now())
  RETURNING true INTO ok;
  RETURN coalesce(ok, false);
END $$;
REVOKE ALL ON FUNCTION public.fit_queue_acquire_lease(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fit_queue_acquire_lease(int) TO service_role;

CREATE OR REPLACE FUNCTION public.fit_queue_wake()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/process-fit-queue',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44"}'::jsonb,
    body := '{"source":"enqueue"}'::jsonb);
EXCEPTION WHEN OTHERS THEN NULL; -- waking is best-effort; rows stay pending
END $$;
REVOKE ALL ON FUNCTION public.fit_queue_wake() FROM PUBLIC, anon, authenticated;

-- Enqueue on candidate join / stage move, only for live client views.
CREATE OR REPLACE FUNCTION public.fit_queue_on_association()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ai_fit_analysis IS NOT NULL OR lower(coalesce(NEW.status,'')) IN ('rejected','withdrawn') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.current_stage_id IS NOT DISTINCT FROM OLD.current_stage_id THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM job_pipeline_shares ps WHERE ps.job_id = NEW.job_id AND ps.is_public
             AND NEW.current_stage_id = ANY(coalesce(ps.visible_stage_ids, '{}'))) THEN
    INSERT INTO fit_analysis_queue (association_id) VALUES (NEW.id)
    ON CONFLICT (association_id) DO UPDATE SET status='pending', next_attempt_at=now(), updated_at=now()
      WHERE fit_analysis_queue.status IN ('failed');
    PERFORM fit_queue_wake();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fit_queue_on_association() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER fit_queue_on_association AFTER INSERT OR UPDATE OF current_stage_id ON public.job_candidate_associations
FOR EACH ROW EXECUTE FUNCTION public.fit_queue_on_association();

-- Enqueue current visible candidates when a view goes live or gains stages.
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
    AND a.current_stage_id = ANY(coalesce(NEW.visible_stage_ids, '{}'))
  ON CONFLICT (association_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN PERFORM fit_queue_wake(); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fit_queue_on_share() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER fit_queue_on_share AFTER INSERT OR UPDATE OF is_public, visible_stage_ids ON public.job_pipeline_shares
FOR EACH ROW EXECUTE FUNCTION public.fit_queue_on_share();