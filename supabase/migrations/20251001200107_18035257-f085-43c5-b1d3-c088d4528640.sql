-- =====================================================
-- PHASE 1: CRITICAL DATA EXPOSURE FIX
-- Emergency Security Patch for Candidates Table
-- =====================================================

-- 1.1 FIX CANDIDATES TABLE RLS POLICIES (CRITICAL VULNERABILITY)
-- The current policy has "using: true" which means NO security restrictions
-- This exposes 168 candidate records with personal data to the public internet

-- Drop the dangerous policy that exposes all candidate data publicly
DROP POLICY IF EXISTS "Organization members can view candidates" ON candidates;

-- Create secure organization-based SELECT policy
CREATE POLICY "Organization members can view org candidates" ON candidates
FOR SELECT USING (
  -- Platform admins can see all candidates
  get_user_type_secure() = 'platform_admin'
  OR
  -- Organization members can only see their organization's candidates
  (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM members 
      WHERE user_id = auth.uid() AND user_status = 'active'
    )
  )
);

-- Add job-assignment based access for candidates
CREATE POLICY "Job assigned users can view candidates" ON candidates
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM job_candidate_associations jca
    JOIN job_assignments ja ON ja.job_id = jca.job_id
    WHERE jca.candidate_id = candidates.id AND ja.user_id = auth.uid()
  )
);

-- Add INSERT policy for organization recruiters and admins
CREATE POLICY "Organization recruiters can create candidates" ON candidates
FOR INSERT WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    organization_id IN (
      SELECT organization_id FROM members 
      WHERE user_id = auth.uid() 
      AND user_status = 'active'
      AND member_role IN ('admin', 'recruiter')
    )
    AND created_by = auth.uid()
  )
);

-- Add UPDATE policy for organization recruiters and admins
CREATE POLICY "Organization recruiters can update org candidates" ON candidates
FOR UPDATE USING (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM members 
      WHERE user_id = auth.uid() 
      AND user_status = 'active'
      AND member_role IN ('admin', 'recruiter')
    )
  )
) WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM members 
      WHERE user_id = auth.uid() 
      AND user_status = 'active'
      AND member_role IN ('admin', 'recruiter')
    )
  )
);

-- Add DELETE policy for organization admins only
CREATE POLICY "Organization admins can delete org candidates" ON candidates
FOR DELETE USING (
  get_user_type_secure() = 'platform_admin'
  OR
  (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM members 
      WHERE user_id = auth.uid() 
      AND user_status = 'active'
      AND member_role = 'admin'
    )
  )
);

-- 1.2 SECURE JOBS TABLE PUBLIC ACCESS
-- Remove the overly permissive public policy that exposes internal job data
DROP POLICY IF EXISTS "Public can view jobs with active postings - safe" ON jobs;

-- Public access to jobs should ONLY happen through the job_postings table
-- which has proper field filtering for public consumption
-- No direct public access to the jobs table to prevent salary/hiring team exposure

-- 1.3 ADD AUDIT LOGGING
-- Log this critical security fix
DO $$
BEGIN
  RAISE NOTICE 'SECURITY FIX APPLIED: Candidates table RLS policies updated to prevent public data exposure';
  RAISE NOTICE 'SECURITY FIX APPLIED: Jobs table direct public access removed';
END $$;