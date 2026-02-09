CREATE POLICY tenants_public_read_for_postings ON public.tenants
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.tenant_id = tenants.id
        AND jp.is_active = true
        AND jp.deleted_at IS NULL
    )
  );