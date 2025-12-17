-- Drop existing broken policies that use organization_id
DROP POLICY IF EXISTS "Users can view attachments in their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments for candidates in their organizati" ON storage.objects;
DROP POLICY IF EXISTS "Users can update attachments in their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete attachments in their organization" ON storage.objects;

-- Create fixed policies using tenant_id instead of organization_id
CREATE POLICY "Users can view attachments in their tenant"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IN (
    SELECT m.user_id FROM members m
    WHERE m.tenant_id IN (
      SELECT c.tenant_id FROM candidates c
      WHERE c.id::text = (storage.foldername(objects.name))[1]
    )
  )
);

CREATE POLICY "Users can upload attachments for candidates in their tenant"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IN (
    SELECT m.user_id FROM members m
    WHERE m.tenant_id IN (
      SELECT c.tenant_id FROM candidates c
      WHERE c.id::text = (storage.foldername(objects.name))[1]
    )
  )
);

CREATE POLICY "Users can update attachments in their tenant"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IN (
    SELECT m.user_id FROM members m
    WHERE m.tenant_id IN (
      SELECT c.tenant_id FROM candidates c
      WHERE c.id::text = (storage.foldername(objects.name))[1]
    )
  )
);

CREATE POLICY "Users can delete attachments in their tenant"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IN (
    SELECT m.user_id FROM members m
    WHERE m.tenant_id IN (
      SELECT c.tenant_id FROM candidates c
      WHERE c.id::text = (storage.foldername(objects.name))[1]
    )
  )
);