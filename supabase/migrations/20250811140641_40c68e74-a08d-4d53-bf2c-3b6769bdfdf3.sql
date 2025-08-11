-- Create score rating enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'score_rating') THEN
    CREATE TYPE public.score_rating AS ENUM ('definitely_no','no','yes','strong_yes');
  END IF;
END $$;

-- Create job_stage_scorecards table
CREATE TABLE IF NOT EXISTS public.job_stage_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.job_candidate_associations(id) ON DELETE CASCADE,
  stage_instance_id uuid NOT NULL REFERENCES public.job_hiring_stages(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.job_candidates(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  rating public.score_rating NOT NULL,
  general_overview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_scorecards_association ON public.job_stage_scorecards(association_id);
CREATE INDEX IF NOT EXISTS idx_scorecards_stage_instance ON public.job_stage_scorecards(stage_instance_id);
CREATE INDEX IF NOT EXISTS idx_scorecards_created_by ON public.job_stage_scorecards(created_by);
CREATE INDEX IF NOT EXISTS idx_scorecards_job ON public.job_stage_scorecards(job_id);

-- Trigger to populate derived columns and validate linkage
CREATE OR REPLACE FUNCTION public.handle_scorecard_insert()
RETURNS trigger AS $$
DECLARE
  assoc_job uuid;
  assoc_candidate uuid;
  stage_job uuid;
BEGIN
  -- Set author
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  -- Derive job_id and candidate_id from association
  SELECT jca.job_id, jca.candidate_id
    INTO assoc_job, assoc_candidate
  FROM public.job_candidate_associations jca
  WHERE jca.id = NEW.association_id;

  IF assoc_job IS NULL THEN
    RAISE EXCEPTION 'Invalid association_id % for scorecard', NEW.association_id;
  END IF;

  NEW.job_id := assoc_job;
  NEW.candidate_id := assoc_candidate;

  -- Validate stage belongs to the same job
  SELECT jhs.job_id INTO stage_job
  FROM public.job_hiring_stages jhs
  WHERE jhs.id = NEW.stage_instance_id;

  IF stage_job IS NULL OR stage_job <> assoc_job THEN
    RAISE EXCEPTION 'Stage instance does not belong to the same job as the association';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

DROP TRIGGER IF EXISTS trg_handle_scorecard_insert ON public.job_stage_scorecards;
CREATE TRIGGER trg_handle_scorecard_insert
BEFORE INSERT ON public.job_stage_scorecards
FOR EACH ROW EXECUTE FUNCTION public.handle_scorecard_insert();

-- updated_at handler
DROP TRIGGER IF EXISTS set_job_stage_scorecards_updated_at ON public.job_stage_scorecards;
CREATE TRIGGER set_job_stage_scorecards_updated_at
BEFORE UPDATE ON public.job_stage_scorecards
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.job_stage_scorecards ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  -- View policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_stage_scorecards' AND policyname = 'Users can view accessible scorecards'
  ) THEN
    CREATE POLICY "Users can view accessible scorecards"
    ON public.job_stage_scorecards
    FOR SELECT
    USING (
      created_by = auth.uid()
      OR public.get_user_type_secure() = 'platform_admin'
      OR EXISTS (
        SELECT 1 FROM public.members m
        JOIN public.jobs j ON j.organization_id = m.organization_id
        WHERE j.id = job_id AND m.user_id = auth.uid() AND m.user_status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.job_id = job_id AND ja.user_id = auth.uid()
      )
    );
  END IF;

  -- Insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_stage_scorecards' AND policyname = 'Users can create scorecards for accessible jobs'
  ) THEN
    CREATE POLICY "Users can create scorecards for accessible jobs"
    ON public.job_stage_scorecards
    FOR INSERT
    WITH CHECK (
      created_by = auth.uid()
      AND (
        public.get_user_type_secure() = 'platform_admin'
        OR EXISTS (
          SELECT 1 FROM public.members m
          JOIN public.job_candidate_associations jca ON jca.id = association_id
          JOIN public.jobs j ON j.id = jca.job_id
          WHERE m.user_id = auth.uid() AND m.organization_id = j.organization_id AND m.user_status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM public.job_candidate_associations jca
          JOIN public.job_assignments ja ON ja.job_id = jca.job_id
          WHERE jca.id = association_id AND ja.user_id = auth.uid()
        )
      )
    );
  END IF;

  -- Update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_stage_scorecards' AND policyname = 'Users can update their own scorecards'
  ) THEN
    CREATE POLICY "Users can update their own scorecards"
    ON public.job_stage_scorecards
    FOR UPDATE
    USING (created_by = auth.uid() OR public.get_user_type_secure() = 'platform_admin')
    WITH CHECK (created_by = auth.uid() OR public.get_user_type_secure() = 'platform_admin');
  END IF;
END $$;