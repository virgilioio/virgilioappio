ALTER TABLE public.organizations
  ADD COLUMN default_output_language text NOT NULL DEFAULT 'en';

ALTER TABLE public.jobs
  ADD COLUMN output_language text;

ALTER TABLE public.job_candidate_associations
  ADD COLUMN output_language text,
  ADD COLUMN ai_fit_output_language text,
  ADD COLUMN ai_fit_keep_proper_nouns boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.validate_gio_fit_language_codes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    IF NEW.default_output_language IS NULL OR NEW.default_output_language NOT IN ('en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'pl') THEN
      RAISE EXCEPTION 'Unsupported Gio Fit output language: %', NEW.default_output_language;
    END IF;
  ELSIF TG_TABLE_NAME = 'jobs' THEN
    IF NEW.output_language IS NOT NULL AND NEW.output_language NOT IN ('en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'pl') THEN
      RAISE EXCEPTION 'Unsupported Gio Fit output language: %', NEW.output_language;
    END IF;
  ELSIF TG_TABLE_NAME = 'job_candidate_associations' THEN
    IF NEW.output_language IS NOT NULL AND NEW.output_language NOT IN ('en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'pl') THEN
      RAISE EXCEPTION 'Unsupported Gio Fit output language: %', NEW.output_language;
    END IF;
    IF NEW.ai_fit_output_language IS NOT NULL AND NEW.ai_fit_output_language NOT IN ('en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'pl') THEN
      RAISE EXCEPTION 'Unsupported Gio Fit generated language: %', NEW.ai_fit_output_language;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_organizations_gio_fit_language
BEFORE INSERT OR UPDATE OF default_output_language ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.validate_gio_fit_language_codes();

CREATE TRIGGER validate_jobs_gio_fit_language
BEFORE INSERT OR UPDATE OF output_language ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.validate_gio_fit_language_codes();

CREATE TRIGGER validate_association_gio_fit_language
BEFORE INSERT OR UPDATE OF output_language, ai_fit_output_language ON public.job_candidate_associations
FOR EACH ROW EXECUTE FUNCTION public.validate_gio_fit_language_codes();