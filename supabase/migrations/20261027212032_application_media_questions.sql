-- Audio and Video questions on application forms (Allan, 2026-10-27).
--
-- Candidates answer them by uploading a recording: audio (MP3, M4A, WAV, OGG,
-- AAC, up to 100 MB) or video (MP4, MOV, WebM, up to 500 MB). The existing
-- File upload question now works the same way (documents and images, up to
-- 25 MB). The browser uploads straight to storage through a one-time link from
-- the public-application-upload Edge Function, into
-- candidate-attachments/public-applications/staged/{posting}/{question}/;
-- public-submit-application checks the file and moves it into the
-- candidate's files when they apply. The answer keeps a pointer to the file.
--
-- Uploads nobody submitted are cleared daily (pg_cron
-- 'application-uploads-sweep' calls the function with the internal secret).

alter type public.field_type add value if not exists 'audio';
alter type public.field_type add value if not exists 'video';

select cron.schedule(
  'application-uploads-sweep',
  '41 9 * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/public-application-upload',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{"sweep": true}'::jsonb
  ) as request_id
  $cmd$
);
