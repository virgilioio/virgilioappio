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

## Replacing a resume removes the old copy (added)
4. **From now on, replacing a resume keeps only the new file.** When a new resume is uploaded, the previous resume is deleted, both the file and its record. This also saves storage space.
5. **One-time clean-up of existing candidates.** For every candidate who has a current resume, delete PDF and Word files that were uploaded **before** that resume and aren't marked as resume (Alexander Rodrigues' two old copies, Katarina's and Olivia's old copies, and so on). The newest resume stays. Audio, images and other file types are never touched. Files uploaded after the current resume are kept too.
   - Accepted trade-off: a real document (a cover letter, for example) uploaded before the current resume would also be deleted.
   - Before deleting, I'll report how many files and candidates are affected.

### Technical details (added)
- `useCandidateAttachments.uploadAttachment(file, true)` and the other resume-replace paths (`CandidateFormSheet`, the resume tab's replace action, the `enrich-candidate-profile` upload path): after the new resume record is saved, delete the candidate's other resume rows (`is_resume = true`, id ≠ new) and remove their storage objects.
- Clean-up: a data-change query picks rows where `is_resume = false`, the MIME type or extension is PDF or Word, and `created_at` is earlier than the candidate's latest resume `created_at`. The storage objects on those same paths are removed with a service-key script, then the rows are deleted.
- Add this task to the project task list (`roadmap.md`).
