-- Update candidate-attachments bucket to allow ZIP files
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/zip', 'application/x-zip-compressed']
WHERE id = 'candidate-attachments';