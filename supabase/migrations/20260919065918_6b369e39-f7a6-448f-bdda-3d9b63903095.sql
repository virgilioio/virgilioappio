ALTER TABLE public.job_suggested_candidates_cache
  ADD COLUMN IF NOT EXISTS ai_fit_analysis jsonb,
  ADD COLUMN IF NOT EXISTS ai_fit_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_fit_output_language text,
  ADD COLUMN IF NOT EXISTS dossier_status text,
  ADD COLUMN IF NOT EXISTS dossier_error text;

CREATE OR REPLACE FUNCTION public.copy_suggestion_dossier_to_association()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cached RECORD;
BEGIN
  IF NEW.ai_fit_analysis IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT ai_fit_analysis, ai_fit_score, ai_fit_confidence, ai_fit_generated_at, ai_fit_output_language
    INTO cached
  FROM public.job_suggested_candidates_cache
  WHERE job_id = NEW.job_id
    AND candidate_id = NEW.candidate_id
    AND ai_fit_analysis IS NOT NULL
  LIMIT 1;

  IF cached IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.ai_fit_analysis := cached.ai_fit_analysis;
  NEW.ai_fit_score := cached.ai_fit_score;
  NEW.ai_fit_confidence := cached.ai_fit_confidence;
  NEW.ai_fit_generated_at := cached.ai_fit_generated_at;
  NEW.ai_fit_output_language := COALESCE(cached.ai_fit_output_language, NEW.ai_fit_output_language);
  NEW.ai_fit_version := COALESCE(NULLIF(NEW.ai_fit_version, 0), 1);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS copy_suggestion_dossier_to_association_trg ON public.job_candidate_associations;
CREATE TRIGGER copy_suggestion_dossier_to_association_trg
BEFORE INSERT ON public.job_candidate_associations
FOR EACH ROW EXECUTE FUNCTION public.copy_suggestion_dossier_to_association();