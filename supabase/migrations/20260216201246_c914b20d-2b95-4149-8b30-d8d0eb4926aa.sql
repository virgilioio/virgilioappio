
-- Add RLS policies for posting_field_select_options
-- Mirrors access pattern of parent table job_posting_application_fields

-- INSERT: platform admins, org recruiters/admins, or job-assigned users
CREATE POLICY "Org members can insert select options"
ON public.posting_field_select_options
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1
    FROM public.job_posting_application_fields pf
    JOIN public.job_postings jp ON jp.id = pf.posting_id
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE pf.id = posting_field_select_options.posting_field_id
    AND (
      EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.user_id = auth.uid()
        AND m.organization_id = j.organization_id
        AND m.user_status = 'active'
        AND m.member_role IN ('admin', 'recruiter')
      )
      OR EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.job_id = j.id
        AND ja.user_id = auth.uid()
        AND ja.deleted_at IS NULL
      )
    )
  )
);

-- UPDATE: same access pattern
CREATE POLICY "Org members can update select options"
ON public.posting_field_select_options
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1
    FROM public.job_posting_application_fields pf
    JOIN public.job_postings jp ON jp.id = pf.posting_id
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE pf.id = posting_field_select_options.posting_field_id
    AND (
      EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.user_id = auth.uid()
        AND m.organization_id = j.organization_id
        AND m.user_status = 'active'
        AND m.member_role IN ('admin', 'recruiter')
      )
      OR EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.job_id = j.id
        AND ja.user_id = auth.uid()
        AND ja.deleted_at IS NULL
      )
    )
  )
);

-- DELETE: same access pattern
CREATE POLICY "Org members can delete select options"
ON public.posting_field_select_options
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1
    FROM public.job_posting_application_fields pf
    JOIN public.job_postings jp ON jp.id = pf.posting_id
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE pf.id = posting_field_select_options.posting_field_id
    AND (
      EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.user_id = auth.uid()
        AND m.organization_id = j.organization_id
        AND m.user_status = 'active'
        AND m.member_role IN ('admin', 'recruiter')
      )
      OR EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.job_id = j.id
        AND ja.user_id = auth.uid()
        AND ja.deleted_at IS NULL
      )
    )
  )
);

-- SELECT for authenticated org members (existing policy only covers public/active postings)
CREATE POLICY "Org members can view select options"
ON public.posting_field_select_options
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1
    FROM public.job_posting_application_fields pf
    JOIN public.job_postings jp ON jp.id = pf.posting_id
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE pf.id = posting_field_select_options.posting_field_id
    AND (
      EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.user_id = auth.uid()
        AND m.organization_id = j.organization_id
        AND m.user_status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.job_id = j.id
        AND ja.user_id = auth.uid()
        AND ja.deleted_at IS NULL
      )
    )
  )
);
