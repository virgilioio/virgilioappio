-- Allow users to view organization names for organizations where they have job assignments
CREATE POLICY "Users can view organizations for assigned jobs" ON public.organizations
FOR SELECT 
TO authenticated 
USING (
  -- Allow if user has job assignments in this organization
  EXISTS (
    SELECT 1 
    FROM public.job_assignments ja
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE ja.user_id = auth.uid() 
      AND j.organization_id = organizations.id
  )
);