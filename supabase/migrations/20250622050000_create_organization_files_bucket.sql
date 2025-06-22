
-- Create storage bucket for organization files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('organization-files', 'organization-files', true);

-- Create RLS policies for the bucket
CREATE POLICY "Users can upload organization files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'organization-files');

CREATE POLICY "Users can view organization files" ON storage.objects
FOR SELECT USING (bucket_id = 'organization-files');

CREATE POLICY "Users can update organization files" ON storage.objects
FOR UPDATE USING (bucket_id = 'organization-files');

CREATE POLICY "Users can delete organization files" ON storage.objects
FOR DELETE USING (bucket_id = 'organization-files');
