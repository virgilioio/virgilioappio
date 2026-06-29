
-- Banner uploads live under careers-logos/{tenant_id}/job-banners/{posting_id}/{filename}
-- Existing INSERT/UPDATE/DELETE on careers-logos requires workspace owner; broaden to any
-- tenant member ONLY for the job-banners subpath so hiring managers can manage posting banners.

CREATE POLICY "Tenant members can upload job posting banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'careers-logos'
  AND (storage.foldername(name))[2] = 'job-banners'
  AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Tenant members can update job posting banners"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'careers-logos'
  AND (storage.foldername(name))[2] = 'job-banners'
  AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Tenant members can delete job posting banners"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'careers-logos'
  AND (storage.foldername(name))[2] = 'job-banners'
  AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid)
);
