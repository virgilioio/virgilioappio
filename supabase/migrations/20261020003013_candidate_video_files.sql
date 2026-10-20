-- Candidate files take videos (Allan, 2026-10-20): MP4 and other videos up to
-- 500 MB, audio up to 100 MB, everything else 25 MB as before. The app checks
-- each kind (src/lib/candidateFiles.ts); the bucket holds the largest, so a
-- 500 MB video isn't refused here. The project's global upload limit
-- (Storage › Settings) must be at least 500 MB too.
update storage.buckets
   set file_size_limit = 524288000
 where id = 'candidate-attachments';
