-- 1) Schema change: add is_resume
ALTER TABLE public.candidate_attachments
  ADD COLUMN IF NOT EXISTS is_resume boolean NOT NULL DEFAULT false;

-- 2) Ensure only one resume per candidate
CREATE UNIQUE INDEX IF NOT EXISTS unique_resume_per_job_candidate
  ON public.candidate_attachments (candidate_id)
  WHERE is_resume;

-- 3) Trigger to demote previous resumes when a new one is set
CREATE OR REPLACE FUNCTION public.ensure_single_resume_per_candidate()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_resume = true THEN
    UPDATE public.candidate_attachments
      SET is_resume = false
      WHERE candidate_id = NEW.candidate_id
        AND id <> NEW.id
        AND is_resume = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

DROP TRIGGER IF EXISTS trg_single_resume_insert ON public.candidate_attachments;
DROP TRIGGER IF EXISTS trg_single_resume_update ON public.candidate_attachments;
CREATE TRIGGER trg_single_resume_insert
  BEFORE INSERT ON public.candidate_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_resume_per_candidate();

CREATE TRIGGER trg_single_resume_update
  BEFORE UPDATE OF is_resume ON public.candidate_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_resume_per_candidate();

-- 4) RLS policy to allow updates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'candidate_attachments' 
      AND policyname = 'Users can update attachments for candidates they can manage') THEN
    CREATE POLICY "Users can update attachments for candidates they can manage"
    ON public.candidate_attachments
    FOR UPDATE
    USING (
      (
        EXISTS (
          SELECT 1
          FROM job_candidates jc
          JOIN jobs j ON jc.job_id = j.id
          JOIN members m ON j.organization_id = m.organization_id
          WHERE jc.id = candidate_attachments.candidate_id
            AND m.user_id = auth.uid()
            AND m.member_role = ANY (ARRAY['admin'::member_role, 'recruiter'::member_role])
            AND m.user_status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM job_candidates jc
          JOIN job_assignments ja ON jc.job_id = ja.job_id
          WHERE jc.id = candidate_attachments.candidate_id
            AND ja.user_id = auth.uid()
        )
        OR get_user_type_secure() = 'platform_admin'
      )
    )
    WITH CHECK (
      (
        EXISTS (
          SELECT 1
          FROM job_candidates jc
          JOIN jobs j ON jc.job_id = j.id
          JOIN members m ON j.organization_id = m.organization_id
          WHERE jc.id = candidate_attachments.candidate_id
            AND m.user_id = auth.uid()
            AND m.member_role = ANY (ARRAY['admin'::member_role, 'recruiter'::member_role])
            AND m.user_status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM job_candidates jc
          JOIN job_assignments ja ON jc.job_id = ja.job_id
          WHERE jc.id = candidate_attachments.candidate_id
            AND ja.user_id = auth.uid()
        )
        OR get_user_type_secure() = 'platform_admin'
      )
    );
  END IF;
END $$;