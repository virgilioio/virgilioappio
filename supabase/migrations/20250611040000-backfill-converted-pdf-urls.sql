-- Backfill candidate_attachments.converted_pdf_url to store storage paths instead of public URLs
UPDATE candidate_attachments
SET converted_pdf_url = NULLIF(
  split_part(
    regexp_replace(
      converted_pdf_url,
      '^https?://[^/]*/storage/v1/object/(public|sign|authenticated)/candidate-attachments/',
      ''
    ),
    '?',
    1
  ),
  ''
)
WHERE converted_pdf_url IS NOT NULL
  AND converted_pdf_url ~ '^https?://'
  AND converted_pdf_url LIKE '%candidate-attachments/%';
