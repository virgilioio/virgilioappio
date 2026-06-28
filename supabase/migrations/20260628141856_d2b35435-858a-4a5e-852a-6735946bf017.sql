CREATE POLICY job_stages_platform_admin_manage
ON public.job_stages
FOR ALL
TO authenticated
USING (
  tenant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_type = 'platform_admin'
      AND m.user_status = 'active'
  )
)
WITH CHECK (
  tenant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_type = 'platform_admin'
      AND m.user_status = 'active'
  )
);