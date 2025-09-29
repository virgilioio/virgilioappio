-- Add RLS policy to allow workspace owners and admins to create jobs
CREATE POLICY "Organization admins and recruiters can create jobs" 
ON public.jobs 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.members m 
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = jobs.organization_id 
      AND m.user_status = 'active' 
      AND m.member_role IN ('admin', 'recruiter')
      AND m.user_type IN ('workspace_owner', 'member')
  )
);