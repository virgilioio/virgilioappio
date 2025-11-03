-- Create RLS policies for candidate-attachments bucket
-- Allow authenticated users to view attachments in their organization
CREATE POLICY "Users can view attachments in their organization"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'candidate-attachments' 
  AND auth.uid() IN (
    SELECT user_id FROM members 
    WHERE organization_id IN (
      SELECT organization_id FROM candidates 
      WHERE id::text = (storage.foldername(name))[1]
    )
  )
);

-- Allow authenticated users to upload attachments for candidates in their organization
CREATE POLICY "Users can upload attachments for candidates in their organization"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IN (
    SELECT user_id FROM members 
    WHERE organization_id IN (
      SELECT organization_id FROM candidates 
      WHERE id::text = (storage.foldername(name))[1]
    )
  )
);

-- Allow authenticated users to update attachments in their organization
CREATE POLICY "Users can update attachments in their organization"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IN (
    SELECT user_id FROM members 
    WHERE organization_id IN (
      SELECT organization_id FROM candidates 
      WHERE id::text = (storage.foldername(name))[1]
    )
  )
);

-- Allow authenticated users to delete attachments in their organization
CREATE POLICY "Users can delete attachments in their organization"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IN (
    SELECT user_id FROM members 
    WHERE organization_id IN (
      SELECT organization_id FROM candidates 
      WHERE id::text = (storage.foldername(name))[1]
    )
  )
);