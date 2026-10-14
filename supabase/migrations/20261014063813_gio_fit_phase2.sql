-- Gio Fit, phase 2 (Allan, 2026-10-14): skill priorities on the job, a score
-- history, and re-scores when interview evidence arrives.
--
-- 1. jobs.skill_priorities — one priority per skill in jobs.skills:
--      must  = must-have (green)      counts toward the must-have caps
--      nice  = nice-to-have (blue)    what Skills Alignment is scored on
--      bonus = extra points (lilac)   can lift, never lower
--    Skills with no entry are nice-to-have, so no existing job gains a cap it
--    did not have. must_have_skills is kept in sync from it, so the Hiring
--    Targets card and anything else reading it keeps working.
-- 2. fit_score_history — every stored assessment, so a dossier can show
--    "72 on paper → 81 after the panel" and scores can be checked against
--    outcomes. Filled by a trigger on the association; nothing else writes it.
-- 3. fit_analysis_queue.reason — 'initial' (client view, as today) or
--    'rescore' (a scorecard was submitted on a pipeline that already has a
--    dossier). The processor only skips rows that already have a dossier when
--    the reason is 'initial'.

-- ── 1. Skill priorities ────────────────────────────────────────────────────

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS skill_priorities jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.jobs.skill_priorities IS
  'skill → must | nice | bonus. Keys are entries of jobs.skills; a missing key means nice.';

-- Values are only ever one of the three priorities.
CREATE OR REPLACE FUNCTION public.skill_priorities_valid(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$
  SELECT jsonb_typeof(p) = 'object'
     AND NOT EXISTS (SELECT 1 FROM jsonb_each_text(p) e WHERE e.value NOT IN ('must', 'nice', 'bonus'));
$$;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_skill_priorities_values CHECK (public.skill_priorities_valid(skill_priorities));

-- must_have_skills follows the green pills; priorities for removed skills are discarded.
CREATE OR REPLACE FUNCTION public.jobs_sync_skill_priorities()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE kept jsonb;
BEGIN
  SELECT coalesce(jsonb_object_agg(p.key, p.value), '{}'::jsonb) INTO kept
  FROM jsonb_each_text(coalesce(NEW.skill_priorities, '{}'::jsonb)) p
  WHERE p.key = ANY (coalesce(NEW.skills, '{}'::text[]));
  NEW.skill_priorities := kept;
  NEW.must_have_skills := coalesce(
    (SELECT array_agg(s ORDER BY ord) FROM unnest(coalesce(NEW.skills, '{}'::text[])) WITH ORDINALITY AS u(s, ord)
      WHERE kept ->> s = 'must'),
    '{}'::text[]);
  RETURN NEW;
END $$;

CREATE TRIGGER jobs_sync_skill_priorities
  BEFORE INSERT OR UPDATE OF skills, skill_priorities ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_sync_skill_priorities();

-- ── 2. Score history ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fit_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.job_candidate_associations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  job_id uuid NOT NULL,
  version int NOT NULL,
  score int,
  confidence text,
  -- What the assessment was built from and how it was bounded (v4 `scoring`).
  dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,
  must_haves jsonb NOT NULL DEFAULT '[]'::jsonb,
  scoring jsonb,
  changes_since_last text,
  -- Why it ran: refresh (a person pressed Refresh), auto (stale on open),
  -- queue (client view), scorecard (interview evidence), or unknown.
  trigger text NOT NULL DEFAULT 'unknown',
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, version)
);
CREATE INDEX IF NOT EXISTS fit_score_history_assoc_idx ON public.fit_score_history (association_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS fit_score_history_job_idx ON public.fit_score_history (job_id, generated_at DESC);

ALTER TABLE public.fit_score_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.fit_score_history TO authenticated;
GRANT ALL ON public.fit_score_history TO service_role;

-- Readable by whoever can read the association; written only by the trigger.
CREATE POLICY "Read fit history with the association"
  ON public.fit_score_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_candidate_associations a WHERE a.id = fit_score_history.association_id));

CREATE OR REPLACE FUNCTION public.fit_history_on_association()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ai_fit_analysis IS NULL THEN RETURN NEW; END IF;
  -- Only a new assessment, not an inputs check or a language rewrite of the same one.
  IF TG_OP = 'UPDATE' AND NEW.ai_fit_generated_at IS NOT DISTINCT FROM OLD.ai_fit_generated_at THEN RETURN NEW; END IF;
  INSERT INTO fit_score_history (association_id, candidate_id, job_id, version, score, confidence, dimensions, must_haves, scoring, changes_since_last, trigger, generated_at)
  VALUES (
    NEW.id, NEW.candidate_id, NEW.job_id, coalesce(NEW.ai_fit_version, 1), NEW.ai_fit_score, NEW.ai_fit_confidence,
    coalesce(NEW.ai_fit_analysis -> 'dimensions', '[]'::jsonb),
    coalesce(NEW.ai_fit_analysis -> 'must_haves', '[]'::jsonb),
    NEW.ai_fit_analysis -> 'scoring',
    NEW.ai_fit_analysis ->> 'changes_since_last',
    coalesce(NEW.ai_fit_analysis -> 'scoring' ->> 'trigger', 'unknown'),
    coalesce(NEW.ai_fit_generated_at, now()))
  ON CONFLICT (association_id, version) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fit_history_on_association() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER fit_history_on_association
  AFTER INSERT OR UPDATE OF ai_fit_analysis, ai_fit_generated_at ON public.job_candidate_associations
  FOR EACH ROW EXECUTE FUNCTION public.fit_history_on_association();

-- Today's dossiers become version 1 of their history, so trajectories start now.
INSERT INTO public.fit_score_history (association_id, candidate_id, job_id, version, score, confidence, dimensions, must_haves, scoring, changes_since_last, trigger, generated_at)
SELECT a.id, a.candidate_id, a.job_id, coalesce(a.ai_fit_version, 1), a.ai_fit_score, a.ai_fit_confidence,
  coalesce(a.ai_fit_analysis -> 'dimensions', '[]'::jsonb), coalesce(a.ai_fit_analysis -> 'must_haves', '[]'::jsonb),
  a.ai_fit_analysis -> 'scoring', a.ai_fit_analysis ->> 'changes_since_last',
  coalesce(a.ai_fit_analysis -> 'scoring' ->> 'trigger', 'unknown'), coalesce(a.ai_fit_generated_at, a.updated_at, now())
FROM public.job_candidate_associations a
WHERE a.ai_fit_analysis IS NOT NULL
ON CONFLICT (association_id, version) DO NOTHING;

-- ── 3. Re-score on interview evidence ──────────────────────────────────────

ALTER TABLE public.fit_analysis_queue
  ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT 'initial';
ALTER TABLE public.fit_analysis_queue ADD CONSTRAINT fit_analysis_queue_reason_check CHECK (reason IN ('initial', 'rescore'));

-- A submitted scorecard on a pipeline that already has a dossier queues a
-- re-score. Drafts don't count. The function hashes its inputs, so if the
-- scorecard changed nothing the run returns the stored dossier at no cost.
CREATE OR REPLACE FUNCTION public.fit_queue_on_scorecard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE assoc_id uuid;
BEGIN
  IF coalesce(NEW.is_ai_draft, false) THEN RETURN NEW; END IF;
  SELECT a.id INTO assoc_id FROM job_candidate_associations a
  WHERE a.id = NEW.association_id
    AND a.ai_fit_analysis IS NOT NULL
    AND lower(coalesce(a.status, '')) NOT IN ('rejected', 'withdrawn')
  LIMIT 1;
  IF assoc_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO fit_analysis_queue (association_id, reason) VALUES (assoc_id, 'rescore')
  ON CONFLICT (association_id) DO UPDATE
    SET status = 'pending', reason = 'rescore', attempts = 0, next_attempt_at = now(), last_error = NULL, updated_at = now()
    WHERE fit_analysis_queue.status IN ('done', 'failed');
  PERFORM fit_queue_wake();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fit_queue_on_scorecard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER fit_queue_on_scorecard
  AFTER INSERT OR UPDATE OF rating, general_overview, is_ai_draft ON public.job_stage_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.fit_queue_on_scorecard();
