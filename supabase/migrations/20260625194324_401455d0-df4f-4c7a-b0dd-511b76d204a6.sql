
-- Allow anonymous visitors to see the minimum jobs columns needed by the public
-- job posting page (PublicJobPosting.tsx uses jobs!inner(status) to verify the
-- underlying job is still open). Without this, the embedded join returns no
-- rows for logged-out users and the public posting appears as "not found".

-- Narrow anon SELECT policy: only rows for open, non-deleted jobs that have at
-- least one active public job_posting.
CREATE POLICY "Public can view open jobs with active postings"
ON public.jobs
FOR SELECT
TO anon
USING (
  deleted_at IS NULL
  AND status = 'open'
  AND EXISTS (
    SELECT 1 FROM public.job_postings p
    WHERE p.job_id = jobs.id AND p.is_active = true
  )
);

-- Restrict anon to non-sensitive columns only (avoid exposing salary, budget,
-- hiring team, internal notes, etc. via the Data API).
REVOKE SELECT ON public.jobs FROM anon;
GRANT SELECT (id, status) ON public.jobs TO anon;
