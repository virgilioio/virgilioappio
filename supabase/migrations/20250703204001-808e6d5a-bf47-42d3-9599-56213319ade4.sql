-- Drop the existing complex policy for candidate attachments storage
DROP POLICY IF EXISTS "Users can view candidate attachments they have access to" ON storage.objects;

-- Create a simpler, more reliable policy for candidate attachments
CREATE POLICY "Users can view candidate attachments they have access to" ON storage.objects
FOR SELECT USING (
  bucket_id = 'candidate-attachments' AND (
    -- Platform admins can see all
    get_user_type_secure() = 'platform_admin' OR
    -- Users can see attachments for candidates in their organization
    EXISTS (
      SELECT 1 FROM candidate_attachments ca
      JOIN job_candidates jc ON ca.candidate_id = jc.id
      JOIN jobs j ON jc.job_id = j.id
      JOIN members m ON j.organization_id = m.organization_id
      WHERE ca.file_url = objects.name 
      AND m.user_id = auth.uid() 
      AND m.user_status = 'active'
    )
  )
);