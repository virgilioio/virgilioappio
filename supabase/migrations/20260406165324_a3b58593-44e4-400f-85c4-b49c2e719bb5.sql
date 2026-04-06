
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dashboard-photos', 'dashboard-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

CREATE POLICY "Anyone can view dashboard photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'dashboard-photos');

CREATE POLICY "Users can upload their own dashboard photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dashboard-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own dashboard photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'dashboard-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own dashboard photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'dashboard-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
