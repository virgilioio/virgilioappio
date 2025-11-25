-- Add RLS policy for platform admins to view all onboarding progress
CREATE POLICY "Platform admins can view all onboarding progress"
ON public.onboarding_progress
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.members 
    WHERE members.user_id = auth.uid() 
    AND members.user_type = 'platform_admin'
  )
);