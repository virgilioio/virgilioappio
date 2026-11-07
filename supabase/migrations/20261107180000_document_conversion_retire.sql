-- Document conversion retired (2026-11-07). Every upload that wasn't a PDF
-- called convert-document-to-pdf, a placeholder that never converted anything
-- (it would have written a blank one-page PDF) and, with the public key, never
-- managed to update the row either: 67 files sat at "processing" for good and
-- the résumé viewer said "Converting to PDF" forever. Word résumés are shown
-- as they are (the Word viewer), so nothing needs converting: new files are
-- marked done on arrival and the stuck ones are settled.

create or replace function public.trigger_document_conversion()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- Nothing is converted any more: every file is shown as it was uploaded.
  new.conversion_status := 'completed';
  return new;
end;
$function$;

update public.candidate_attachments
   set conversion_status = 'completed'
 where conversion_status = 'processing'
   and converted_pdf_url is null;
