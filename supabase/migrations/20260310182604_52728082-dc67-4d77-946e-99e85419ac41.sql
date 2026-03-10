
-- Fix: Align candidate enrichment tables RLS with tenant-based access
-- Problem: These tables use organization_id matching which breaks for child orgs
-- Solution: Use user_has_tenant_access(tenant_id) matching the candidates table pattern

-- ===================== candidate_work_experience =====================

DROP POLICY IF EXISTS "Org members can view candidate work experience" ON public.candidate_work_experience;
DROP POLICY IF EXISTS "Org members can insert candidate work experience" ON public.candidate_work_experience;
DROP POLICY IF EXISTS "Org members can update candidate work experience" ON public.candidate_work_experience;
DROP POLICY IF EXISTS "Org members can delete candidate work experience" ON public.candidate_work_experience;

CREATE POLICY "candidate_work_experience_select" ON public.candidate_work_experience
FOR SELECT USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_work_experience.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

CREATE POLICY "candidate_work_experience_insert" ON public.candidate_work_experience
FOR INSERT WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_work_experience.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

CREATE POLICY "candidate_work_experience_update" ON public.candidate_work_experience
FOR UPDATE USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_work_experience.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
) WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_work_experience.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

CREATE POLICY "candidate_work_experience_delete" ON public.candidate_work_experience
FOR DELETE USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_work_experience.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

-- ===================== candidate_education =====================

DROP POLICY IF EXISTS "Org members can view candidate education" ON public.candidate_education;
DROP POLICY IF EXISTS "Org members can insert candidate education" ON public.candidate_education;
DROP POLICY IF EXISTS "Org members can update candidate education" ON public.candidate_education;
DROP POLICY IF EXISTS "Org members can delete candidate education" ON public.candidate_education;

CREATE POLICY "candidate_education_select" ON public.candidate_education
FOR SELECT USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_education.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

CREATE POLICY "candidate_education_insert" ON public.candidate_education
FOR INSERT WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_education.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

CREATE POLICY "candidate_education_update" ON public.candidate_education
FOR UPDATE USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_education.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
) WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_education.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

CREATE POLICY "candidate_education_delete" ON public.candidate_education
FOR DELETE USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_education.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

-- ===================== candidate_certifications =====================

DROP POLICY IF EXISTS "Users can view certifications in their org" ON public.candidate_certifications;
DROP POLICY IF EXISTS "Users can insert certifications in their org" ON public.candidate_certifications;
DROP POLICY IF EXISTS "Users can update certifications in their org" ON public.candidate_certifications;
DROP POLICY IF EXISTS "Users can delete certifications in their org" ON public.candidate_certifications;
DROP POLICY IF EXISTS "Service role full access certifications" ON public.candidate_certifications;

CREATE POLICY "candidate_certifications_select" ON public.candidate_certifications
FOR SELECT USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_certifications.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

CREATE POLICY "candidate_certifications_insert" ON public.candidate_certifications
FOR INSERT WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_certifications.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

CREATE POLICY "candidate_certifications_update" ON public.candidate_certifications
FOR UPDATE USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_certifications.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
) WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_certifications.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

CREATE POLICY "candidate_certifications_delete" ON public.candidate_certifications
FOR DELETE USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_certifications.candidate_id
    AND user_has_tenant_access(c.tenant_id)
  )
);

-- Service role policy for edge functions (enrichment)
CREATE POLICY "candidate_certifications_service_role" ON public.candidate_certifications
FOR ALL TO service_role USING (true) WITH CHECK (true);
