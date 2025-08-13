-- Allow public uploads to candidate-attachments bucket for job applications
-- This policy allows unauthenticated users to upload files during public job applications

CREATE POLICY "Allow public uploads for job applications"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-attachments'
  AND (
    -- Allow authenticated users (existing functionality)
    auth.uid() IS NOT NULL
    OR
    -- Allow unauthenticated uploads (for public job applications)
    -- Files uploaded without auth will be associated with candidates created by the edge function
    auth.uid() IS NULL
  )
);

-- Also need to allow public access to view files during the application process
-- This is needed so the edge function (running with service role) can access the files
CREATE POLICY "Allow service role access to candidate attachments"
ON storage.objects FOR ALL
USING (
  bucket_id = 'candidate-attachments'
  AND auth.jwt() ->> 'role' = 'service_role'
);

-- Update existing policies to be more specific and avoid conflicts
DROP POLICY IF EXISTS "Users can upload candidate attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads for job applications" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role access to candidate attachments" ON storage.objects;

-- Recreate with proper names and logic
CREATE POLICY "authenticated_users_can_upload_candidate_attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "public_job_applications_can_upload_files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IS NULL
);

CREATE POLICY "service_role_full_access_candidate_attachments"
ON storage.objects FOR ALL
USING (
  bucket_id = 'candidate-attachments'
  AND auth.jwt() ->> 'role' = 'service_role'
);