-- Fix storage policies for candidate-attachments bucket and align with DB records
-- Drop previous policies if they exist
DROP POLICY IF EXISTS "Users can view candidate attachments for accessible candidates" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload candidate attachments for manageable candidates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete candidate attachments they can manage" ON storage.objects;

-- SELECT: Allow platform admins and users with job access to download
CREATE POLICY "Users can view candidate attachments for accessible candidates"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'candidate-attachments'
  AND (
    public.get_user_type_secure() = 'platform_admin'
    OR EXISTS (
      -- Job candidates: org members or assigned users
      SELECT 1
      FROM public.candidate_attachments ca
      JOIN public.job_candidates jc ON jc.id = ca.candidate_id
      JOIN public.jobs j ON j.id = jc.job_id
      LEFT JOIN public.members m ON m.organization_id = j.organization_id AND m.user_id = auth.uid() AND m.user_status = 'active'
      WHERE ca.file_url = name
        AND (
          m.id IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM public.job_assignments ja 
            WHERE ja.job_id = jc.job_id AND ja.user_id = auth.uid()
          )
        )
    )
    OR EXISTS (
      -- Independent candidates: admins/recruiters only
      SELECT 1
      FROM public.candidate_attachments ca
      JOIN public.candidates c ON c.id = ca.candidate_id
      JOIN public.members m ON m.user_id = auth.uid() AND m.user_status = 'active' AND m.member_role IN ('admin','recruiter')
      WHERE ca.file_url = name
    )
  )
);

-- INSERT: Allow platform admins and recruiters to upload to bucket
CREATE POLICY "Users can upload candidate attachments for manageable candidates"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    public.get_user_type_secure() = 'platform_admin'
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.user_status = 'active' AND m.member_role IN ('recruiter')
    )
  )
);

-- DELETE: Allow platform admins, uploaders, and recruiters/admins to delete
CREATE POLICY "Users can delete candidate attachments they can manage"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'candidate-attachments'
  AND (
    public.get_user_type_secure() = 'platform_admin'
    OR EXISTS (
      SELECT 1 
      FROM public.candidate_attachments ca
      LEFT JOIN public.members m ON m.user_id = auth.uid() AND m.user_status = 'active'
      WHERE ca.file_url = name
        AND (
          ca.uploaded_by = auth.uid()
          OR (m.member_role IN ('admin','recruiter'))
        )
    )
  )
);
