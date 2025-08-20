-- Create RLS policies for candidate-attachments storage bucket

-- Policy 1: Allow users to view/download candidate attachments based on organization membership
CREATE POLICY "Users can view candidate attachments for accessible candidates"
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'candidate-attachments' 
  AND (
    -- Platform admins can access all files
    get_user_type_secure() = 'platform_admin'
    OR 
    -- Users can access files for candidates in their organization or assigned jobs
    EXISTS (
      SELECT 1 
      FROM candidate_attachments ca
      WHERE ca.file_url = 'candidate-attachments/' || name
      AND (
        -- For independent candidates: check organization membership
        (EXISTS (
          SELECT 1 FROM candidates c
          JOIN members m ON m.user_id = auth.uid()
          WHERE c.id = ca.candidate_id 
          AND m.user_status = 'active'
        ))
        OR
        -- For job candidates: check organization membership or job assignment
        (EXISTS (
          SELECT 1 
          FROM job_candidates jc
          JOIN jobs j ON jc.job_id = j.id
          JOIN members m ON j.organization_id = m.organization_id
          WHERE jc.id = ca.candidate_id 
          AND m.user_id = auth.uid() 
          AND m.user_status = 'active'
        ))
        OR
        -- Users assigned to the job can access candidate files
        (EXISTS (
          SELECT 1
          FROM job_candidates jc
          JOIN job_assignments ja ON jc.job_id = ja.job_id
          WHERE jc.id = ca.candidate_id
          AND ja.user_id = auth.uid()
        ))
      )
    )
  )
);

-- Policy 2: Allow authenticated users to upload candidate attachments
CREATE POLICY "Users can upload candidate attachments for manageable candidates"
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    -- Platform admins can upload to any candidate
    get_user_type_secure() = 'platform_admin'
    OR
    -- Regular users can upload for candidates they can manage
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
      AND m.member_role IN ('admin', 'recruiter')
      AND m.user_status = 'active'
    )
  )
);

-- Policy 3: Allow users to delete attachments they have permission to manage
CREATE POLICY "Users can delete candidate attachments they can manage"
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'candidate-attachments'
  AND (
    -- Platform admins can delete any file
    get_user_type_secure() = 'platform_admin'
    OR
    -- Users can delete files for candidates they can manage
    EXISTS (
      SELECT 1 
      FROM candidate_attachments ca
      WHERE ca.file_url = 'candidate-attachments/' || name
      AND (
        -- User uploaded the file
        ca.uploaded_by = auth.uid()
        OR
        -- User has admin/recruiter role in organization
        EXISTS (
          SELECT 1 FROM members m
          WHERE m.user_id = auth.uid()
          AND m.member_role IN ('admin', 'recruiter')
          AND m.user_status = 'active'
        )
      )
    )
  )
);