-- Job posts: cover image and video (Allan, 2026-10-22).
--
-- One public place for a posting's media, so the public job post (read by
-- anyone with the link) can show the cover image and play the video:
-- {job_id}/cover-... (PNG, JPG, WebP) and {job_id}/video-... (MP4), up to
-- 200 MB a file. Only people who can edit the job upload into its folder
-- (can_edit_job, the job files rule). Files are never overwritten: a new
-- cover or video is a new file, and the posting points at the latest.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-posting-media', 'job-posting-media', true, 209715200, array[
  'video/mp4',
  'image/png',
  'image/jpeg',
  'image/webp'
])
on conflict (id) do nothing;

create policy job_posting_media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'job-posting-media' and public.can_edit_job(public.job_file_job(name)));
