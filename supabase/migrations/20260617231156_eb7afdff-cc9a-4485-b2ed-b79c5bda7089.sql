ALTER TABLE public.job_hiring_stages
  ADD COLUMN IF NOT EXISTS interview_duration_minutes int,
  ADD COLUMN IF NOT EXISTS interview_format text,
  ADD COLUMN IF NOT EXISTS sla_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_days int,
  ADD COLUMN IF NOT EXISTS stage_instructions text;

CREATE OR REPLACE FUNCTION public.validate_job_hiring_stage_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.interview_duration_minutes IS NOT NULL
     AND NEW.interview_duration_minutes NOT IN (15, 30, 45, 60, 90) THEN
    RAISE EXCEPTION 'interview_duration_minutes must be one of 15, 30, 45, 60, 90 (got %)', NEW.interview_duration_minutes;
  END IF;

  IF NEW.interview_format IS NOT NULL
     AND NEW.interview_format NOT IN ('video', 'phone', 'onsite') THEN
    RAISE EXCEPTION 'interview_format must be one of video, phone, onsite (got %)', NEW.interview_format;
  END IF;

  IF NEW.sla_enabled = true THEN
    IF NEW.sla_days IS NULL OR NEW.sla_days < 1 THEN
      RAISE EXCEPTION 'sla_days must be a positive integer when sla_enabled is true';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_job_hiring_stage_settings_trg ON public.job_hiring_stages;
CREATE TRIGGER validate_job_hiring_stage_settings_trg
  BEFORE INSERT OR UPDATE ON public.job_hiring_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_job_hiring_stage_settings();