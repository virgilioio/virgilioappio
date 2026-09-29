# Upload any file from the Details card (in-job profile)

## What changes
In the in-job candidate profile, Job details tab, right-hand Details card, the **Files** block works on its own:

- **Upload** opens your computer's file picker, not the Edit Candidate sheet. You can also drag files onto the block.
- **Any file type** is allowed: PDF, DOCX, XLSX, images, MP3/WAV, video, ZIP, and others. You can pick several files at once, up to 25 MB each.
- Files uploaded here are saved as **general attachments**. They never replace the resume, so they don't restart resume parsing or re-scoring.
- The block **lists the files**: the resume first, then the rest, newest first. Each row shows a type icon, the name, the size and the date. Right now the block always says "No files", even when files exist.
- Each row has a small menu with **Open / Preview** (PDFs, images and Office files use the existing preview), **Download** and **Delete** (you confirm first; only people who can edit candidates see Delete).
- While a file uploads, its row shows a spinner. If a file is too big or fails, a clear message explains why.
- Hiring managers, interviewers and phone screens only see the list. Upload and Delete are hidden for them.

## Technical details
- `SidebarRouter.tsx` `FilesBlock`: add a hidden multi-file `<input>` with no type restriction, plus drag-and-drop. It calls a new `onFilesSelected(files)` prop instead of `onUploadFile`.
- `CandidateProfileSheet.tsx`: pass `onFilesSelected` → `uploadAttachment(file, false)` for each file from the `useCandidateAttachments` hook it already uses. Pass `fileSlots` built from `attachments`, and gate by `canEditCandidates`.
- Add a small `SidebarFileRow` built from existing tokens, the badge style and the shared dropdown menu. Preview uses `AttachmentPreviewDialog`; download uses a signed URL from `candidate-attachments`.
- Check the `candidate-attachments` bucket's size and file-type limits. If it only accepts some file types or sizes, widen it with the bucket settings tool (no schema change).
- Uploads keep the current storage path and table shape, so other screens are unaffected.
