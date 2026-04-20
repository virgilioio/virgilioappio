

## Why the PDF transcript ingest didn't analyze

I checked the edge function logs for the period around Alfonso's transcript. The **text-body** email at 18:04 succeeded (35,745 chars extracted, scorecard generated). The **earlier PDF email never produced a single log line** in either `process-candidate-reply-webhook` or `process-transcript-webhook` — meaning either Resend never delivered it, or the function crashed at boot/parse before logging.

Looking at the code in `supabase/functions/process-transcript-webhook/index.ts`, there are **three real failure modes** for PDF attachments:

### 1. `pdf-parse@1.1.1` is broken on Deno (most likely cause)
```ts
import pdfParse from "npm:pdf-parse@1.1.1";
```
This library has a notorious "debug mode" side effect: at module load it executes `if (!module.parent)` which tries to read a hardcoded test file (`./test/data/05-versions-space.pdf`). In Deno's `npm:` shim the `module.parent` check evaluates falsy, the test-file read throws `ENOENT`, and the function boot crashes — silently from the user's POV (Resend gets a 5xx, no app-level log). Confirmed by the fact that we have **zero PDF-path log lines ever** in the transcript webhook history.

### 2. Resend doesn't inline base64 attachment bytes in the webhook payload
The code does:
```ts
const pdfBytes = Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0));
```
But Resend's inbound webhook payload omits `attachment.content` for anything beyond a few KB. Real PDF bytes must be fetched separately from Resend's receiving API:
```
GET https://api.resend.com/emails/receiving/{email_id}/attachments/{attachment_id}
```
Today we only call the receiving API for the **email body** (line 311) — never for attachment binaries. So even if pdf-parse worked, `attachment.content` would be `undefined` for any real-world AI notetaker PDF.

### 3. No fallback when extraction yields nothing
If PDF extraction silently returns empty, we fall through to the 100-char "too short" rejection with no diagnostic about why the PDF failed, and no OCR fallback for image-based PDFs (same gap we discussed for resume parsing).

## The fix

### A. Replace `pdf-parse` with a Deno-friendly extractor
Switch to `unpdf` (`npm:unpdf@0.12.1`) — a Deno/edge-runtime-friendly fork of pdf.js with no filesystem side effects. Same API shape, works under Supabase Edge Runtime. Used by other Lovable projects without issue.

```ts
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

async function extractTextFromPdfBytes(pdfBytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (text || '').trim();
}
```

### B. Fetch attachment bytes from Resend receiving API when missing
In `extractTranscriptContent`, when an attachment has no inline `content` but has an `id` (or filename), fetch it:
```
GET https://api.resend.com/emails/receiving/{email_id}/attachments/{attachment_id}
Authorization: Bearer ${RESEND_API_KEY}
```
Returns `{ content: base64, content_type, filename }`. Cache the email_id from the payload (already used for body fetch on line 311). Add the `RESEND_API_KEY` env check (already configured per logs).

### C. Add OCR fallback for image-only PDFs (notetaker scans/exports)
If `unpdf` extraction returns < 100 chars on a PDF that exists, rasterize the first 5 pages and OCR via GPT-4o vision (same approach we agreed for resume parsing). Reuses the `OPENAI_API_KEY` secret. Capped at 5 pages to control cost — transcript PDFs are rarely scans, but Fireflies/Otter occasionally exports as image PDFs.

### D. Better diagnostics + graceful errors
- Log `attachments` array structure (filenames, content_types, sizes, has_content_bool) on every transcript email
- If PDF parse fails, log the actual error instead of a generic warning
- If still empty after all extraction paths, return a 200 with `status: "ingested_empty"` and store a tombstone row in `scheduled_bookings` with `transcript_metadata.extraction_error` so we can see it in the UI instead of Resend retrying forever

### E. Optional but recommended: notify the recruiter when extraction fails
Send a one-time email back to the original sender (the AI notetaker forwarder) saying *"We received the transcript for {candidate} but couldn't extract text from the attachment. Please paste the transcript inline or send as .txt/.vtt."* Uses `send-user-email` with the candidate's recruiter as the to-address. This closes the loop instead of silently failing.

## Files touched

1. `supabase/functions/process-transcript-webhook/index.ts`
   - Swap `pdf-parse` → `unpdf`
   - Add `fetchAttachmentBytesFromResend(email_id, attachment_id)` helper
   - Wire OCR fallback (`ocrPdfWithVision`) when text extraction yields < 100 chars
   - Improve attachment logging
   - Optionally: trigger recruiter-notify on extraction failure

2. `supabase/functions/_shared/` (if present) — small `pdf-extract.ts` shared helper if we want to reuse for resume parsing later

No DB schema changes. No new secrets (uses existing `RESEND_API_KEY` and `OPENAI_API_KEY`).

## Test plan

After deploy, ask the user to forward the same Alfonso PDF transcript again to the same `int_h8vpfzdh@ingest.gogio.io` address. Expect logs:
```
[Transcript Webhook] Attachments: [{filename: "...pdf", content_type: "application/pdf", size: 123456, has_inline_content: false}]
[Transcript Webhook] Fetching attachment bytes from Resend receiving API...
[Transcript Webhook] Extracted PDF text via unpdf, length: 28432
[Transcript Webhook] Transcript stored, triggering scorecard generation...
```

## Out of scope

- Migrating the resume parser to `unpdf` (separate task — PDF in the resume flow runs in the **browser** via pdfjs, different code path)
- Bulk re-processing of past failed PDF transcripts (we have no record they arrived; would need Resend's retention API)

