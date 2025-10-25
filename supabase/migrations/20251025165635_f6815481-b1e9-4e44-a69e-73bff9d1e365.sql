-- ============================================================
-- Fix Candidates RLS to Mirror Jobs Logic (Hierarchy-Aware)
-- ============================================================

-- Drop the old policy that doesn't respect hierarchy
DROP POLICY IF EXISTS "Org members can view org candidates" ON public.candidates;

-- Create new SELECT policy matching jobs table pattern
CREATE POLICY candidates_virgilio_hierarchy_exclude_saas ON public.candidates
FOR SELECT
USING (
  -- Virgilio staff: see candidates in hierarchy (excluding SaaS)
  (
    lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
    AND candidates.organization_id IN (
      SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
    )
  )
  OR
  -- Everyone else: see only their org candidates
  (
    lower(split_part(public.get_user_email(), '@', 2)) != 'virgilio.tech'
    AND candidates.organization_id = public.get_user_organization_id()
  )
  OR
  -- Job-assigned users can view candidates for their assigned jobs
  (
    EXISTS (
      SELECT 1
      FROM job_candidate_associations jca
      JOIN job_assignments ja ON ja.job_id = jca.job_id
      WHERE jca.candidate_id = candidates.id
        AND ja.user_id = auth.uid()
    )
  )
);

-- Keep other policies unchanged:
-- ✅ "Job assigned users can view candidates" (redundant but harmless)
-- ✅ "Platform admins can manage all candidates" (ALL)
-- ✅ "Org recruiters can create candidates" (INSERT)
-- ✅ "Org recruiters can update candidates" (UPDATE)
-- ✅ "Org admins can delete candidates" (DELETE)

COMMENT ON POLICY candidates_virgilio_hierarchy_exclude_saas ON public.candidates IS 
  'ONLY SELECT policy: Virgilio staff see hierarchy (excluding SaaS), others see own org only. Job-assigned users see their assigned job candidates.';