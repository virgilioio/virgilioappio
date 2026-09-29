# Files card on the public (client) dossier

## Why it's missing
The Files card I added earlier only appears in your team's Gio Fit tab. The dossier link you share with clients is built separately on the server, and it doesn't include files yet. Nothing is broken.

## What changes
- The public dossier (`/d/:token`, plus the dossier you open from the client pipeline `/cp/...`) shows a **Files** card above Dimension breakdown, but only when the candidate has uploaded files. The resume is never listed.
- Clients click a file to open it in the page. PDFs, images, Word documents and text show as a preview. Audio and video play in the browser. There's no download button and no right-click save.
- File links are private and expire after 1 hour. Anyone without the dossier link can't reach the files.
- The same rules as today still apply: if the share is turned off or deactivated, the candidate is rejected (except in a shared Rejected section), or the job is closed, no files appear.
- The PDF export stays as it is, with no files.

## Technical details
- `supabase/functions/dossier-public/index.ts`: using the service key, load `candidate_attachments` where `is_resume = false` for the candidate. Emit an allowlisted `files[]` with `{ id, name, type, size, created_at, url }`, where `url` is a signed URL from `candidate-attachments` that lasts 3600s. Never include storage paths. Redeploy it, and redeploy `pipeline-public` if needed, since it passes the payload through.
- Move the viewer (PDF, image, audio, video, DOCX, text; no download controls) out of `DossierFilesCard` into a shared `DossierFileViewer`. The internal card and the public one both use it.
- `src/components/public/PublicDossierBody.tsx`: render a Files card, styled like the public dossier, above "Dimension breakdown" when `files.length > 0`. Add `files` to the `PublicDossier.tsx` types.
- Check it on the live client pipeline link: open a candidate who has an uploaded MP3 and confirm it plays.
