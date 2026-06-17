
-- =========================================================================
-- 1. AUDIT LOGS: only allow inserting entries for self
-- =========================================================================
DROP POLICY IF EXISTS audit_logs_insert_only ON audit.audit_logs;
CREATE POLICY audit_logs_insert_self
  ON audit.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =========================================================================
-- 2. JOB SUGGESTED CANDIDATES CACHE: tenant-scoped reads
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.job_suggested_candidates_cache;
CREATE POLICY "Tenant members can read suggested cache"
  ON public.job_suggested_candidates_cache
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_suggested_candidates_cache.job_id
        AND public.user_has_tenant_access(j.tenant_id)
    )
  );

-- =========================================================================
-- 3. PROFILES: drop broad anon SELECT, expose via SECURITY DEFINER function
-- =========================================================================
DROP POLICY IF EXISTS "Public can view profiles for active booking configs" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_public_booking_profile(p_short_code text)
RETURNS TABLE(first_name text, last_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.first_name, p.last_name, p.avatar_url
  FROM public.booking_configurations bc
  JOIN public.profiles p ON p.user_id = bc.user_id
  WHERE bc.short_code = p_short_code
    AND bc.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_booking_profile(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_booking_profile(text) TO anon, authenticated;

-- =========================================================================
-- 4. TENANTS: drop broad anon SELECT, expose via SECURITY DEFINER function
-- =========================================================================
DROP POLICY IF EXISTS tenants_public_read_for_postings ON public.tenants;

CREATE OR REPLACE FUNCTION public.get_public_tenant_info(p_tenant_id uuid)
RETURNS TABLE(id uuid, name text, about text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.about
  FROM public.tenants t
  WHERE t.id = p_tenant_id
    AND EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.tenant_id = t.id
        AND jp.is_active = true
        AND jp.deleted_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.get_public_tenant_info(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_info(uuid) TO anon, authenticated;

-- =========================================================================
-- 5. DEPARTMENTS: scope anon SELECT to tenants with active postings
-- =========================================================================
DROP POLICY IF EXISTS "Departments are publicly readable for careers page" ON public.departments;
CREATE POLICY "Departments visible for tenants with active postings"
  ON public.departments
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.tenant_id = departments.tenant_id
        AND jp.is_active = true
        AND jp.deleted_at IS NULL
    )
  );

-- =========================================================================
-- 6. STRIPE WEBHOOK EVENTS: service_role only
-- =========================================================================
DROP POLICY IF EXISTS "Service role can manage webhook events" ON public.stripe_webhook_events;
CREATE POLICY "Service role manages webhook events"
  ON public.stripe_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================================================
-- 7. INVOICE STORAGE: remove JWT-metadata admin checks
-- =========================================================================
DROP POLICY IF EXISTS "Platform admins can manage all invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their organization's invoice files" ON storage.objects;

CREATE POLICY "Users can view their organization invoice files - secure"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoices'
    AND (
      (split_part(name, '/', 1))::uuid = public.get_user_organization_id()
      OR public.get_user_type_secure() = 'platform_admin'
    )
  );

CREATE POLICY "Platform admins can manage invoice files - secure"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'invoices' AND public.get_user_type_secure() = 'platform_admin')
  WITH CHECK (bucket_id = 'invoices' AND public.get_user_type_secure() = 'platform_admin');

-- =========================================================================
-- 8. CANDIDATE ATTACHMENTS: harden anon upload
-- =========================================================================
DROP POLICY IF EXISTS public_job_applications_can_upload_files ON storage.objects;
CREATE POLICY public_job_applications_upload_restricted
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'candidate-attachments'
    AND (storage.foldername(name))[1] = 'public-applications'
    AND (metadata ->> 'mimetype') = ANY (ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ])
    AND ((metadata ->> 'size')::bigint) < 10485760
  );

-- =========================================================================
-- 9. REALTIME: baseline auth requirement on realtime.messages
--    (Full per-tenant private channel scoping tracked as a follow-up.)
-- =========================================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS realtime_authenticated_only ON realtime.messages;
CREATE POLICY realtime_authenticated_only
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);
