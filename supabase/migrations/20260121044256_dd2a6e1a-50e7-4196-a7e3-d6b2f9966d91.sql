-- Drop the overly permissive public policy that exposes PII
DROP POLICY IF EXISTS "Anyone can read booking tokens" ON public.booking_link_tokens;

-- Authenticated users can read tokens they created or for jobs in their organization
CREATE POLICY "Org members can read their org tokens"
ON public.booking_link_tokens FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.members m
    JOIN public.jobs j ON j.organization_id = m.organization_id
    WHERE m.user_id = auth.uid()
    AND j.id = booking_link_tokens.job_id
  )
);

-- Add comment explaining the security fix
COMMENT ON POLICY "Org members can read their org tokens" ON public.booking_link_tokens IS 
'Restricts token visibility to authenticated users within the same organization. Edge functions use service_role to bypass RLS for public token resolution.';