-- Update candidate-attachments bucket to allow 15MB files
UPDATE storage.buckets 
SET file_size_limit = 15728640
WHERE id = 'candidate-attachments';