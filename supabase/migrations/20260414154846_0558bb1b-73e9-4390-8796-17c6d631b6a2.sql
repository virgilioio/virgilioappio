
-- Create the email-attachments storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can read files
CREATE POLICY "Authenticated users can read email attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'email-attachments');

-- RLS: service role and authenticated users can upload
CREATE POLICY "Service role can upload email attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-attachments');
