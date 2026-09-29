# Client dossier files: never show resumes, fix PDF preview, remove from Gio Fit tab

## What I found
- The PDFs showing for Katarina Kalaouze and Olivia Stombert are **older copies of their resumes**. When a resume is replaced, the old copy loses its "resume" mark. The dossier only hid the current resume, so the old copies got through.
- The PDF preview uses the browser's built-in PDF reader, which is blocked here. The candidate profile already uses a reader that works.

## What changes
1. **Resumes are never shown in the client dossier.** A file is hidden if any of these is true:
   - it's the current resume;
   - it's an earlier resume version;
   - it has the same file name as a resume this candidate has ever had.
   Everything else still shows.
2. **PDFs open reliably.** The dossier viewer uses the same PDF reader as the resume view on candidate profiles. There's still no download option.
3. **The Files card is removed from the Gio Fit tab.** Your team keeps using the Files section in the Details card on the Job overview tab. The card appears only in the client dossier.

## Technical details
- `supabase/functions/dossier-public/index.ts`: load all attachments for the candidate. Exclude a file when `is_resume`, when `superseded_by` is set, when it is the target of another row's `superseded_by`, or when its `file_name` (lower-cased) matches any resume row's name. Then sign URLs as before, and redeploy.
- `DossierFilesCard.tsx`: keep only the exported `FileViewer`, renamed and moved to `dossier/DossierFileViewer.tsx`. Its PDF branch renders `PDFResumeViewer` with the blob URL instead of the `<iframe>`. Delete the internal card component.
- `CandidateInsightsTab.tsx`: remove `<DossierFilesCard>` and its import.
- `PublicDossierBody.tsx`: import the viewer from its new location.
- Check it on the live client pipeline link: Katarina's dossier shows no Files card, Alexander's MP3 still plays, and a PDF test file draws its pages.
