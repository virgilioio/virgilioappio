
-- Create RLS policy to allow recruiters to see organization names for organizations where they have job assignments
CREATE POLICY "recruiters_can_view_assigned_organizations" ON public.organizations
FOR SELECT 
TO authenticated 
USING (
  -- Allow if user is a recruiter and has job assignments in this organization
  EXISTS (
    SELECT 1 
    FROM public.members m
    JOIN public.job_assignments ja ON m.user_id = ja.user_id
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE m.user_id = auth.uid() 
      AND m.member_role = 'recruiter'
      AND j.organization_id = organizations.id
  )
);
