

# Why Fireflies Stopped Working + PDF Support Fix

## Why it stopped working

Two compounding issues:

1. **Ingest email was marked as optional attendee** — When `create-booking` added the ingest email (`int_xxxx@ingest.gogio.io`) to the Google Calendar event, it was flagged as `optional: true` (line 387). Fireflies and other AI note-takers only track **required** attendees. Since the ingest email was optional, Fireflies never recognized it as a participant and never sent its transcript there. **This was already fixed** in the previous session — `optional: true` was removed. However, bookings created before the fix still have the old calendar event with the optional flag.

2. **PDF attachments are not supported** — When you manually forwarded the Fireflies transcript, it arrived as a PDF attachment (`application/pdf`). The `extractTranscriptContent` function in `process-transcript-webhook` only handles text-based attachments (`.txt`, `.vtt`, `.srt`, `text/*`). The PDF was silently skipped, leaving only a ~1-character email body, which was rejected as "Transcript content too short."

**In short:** Fireflies didn't send because the ingest email looked optional. When you manually sent it, the PDF format wasn't supported.

## Fix: Add PDF text extraction to the webhook

**`supabase/functions/process-transcript-webhook/index.ts`**

Add a PDF extraction block alongside the existing text attachment handling. In Deno, we can use `pdf-parse` (available on npm via `npm:` specifier) or a lightweight approach using `pdfjs-dist` to extract text from base64-encoded PDF attachments.

The change is localized to `extractTranscriptContent`:

```
// Current: only handles text/* attachments
// New: also handle application/pdf and .pdf files

for (const attachment of emailData.attachments) {
  // Skip calendar attachments (existing)
  ...
  
  // NEW: Handle PDF attachments
  if (attachment.content_type === 'application/pdf' || 
      attachment.filename?.endsWith('.pdf')) {
    try {
      const pdfBytes = Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0));
      const pdfText = await extractTextFromPdfBytes(pdfBytes);
      if (pdfText.length > content.length) {
        content = pdfText;
        metadata.content_source = `attachment:${attachment.filename}`;
      }
    } catch (e) {
      console.warn('[Transcript Webhook] Failed to parse PDF attachment:', e);
    }
  }
  
  // Existing text handling...
}
```

For `extractTextFromPdfBytes`, use `npm:pdf-parse` which works in Deno and extracts text from a PDF buffer in a single call — lightweight and no browser dependencies needed.

After the code change, redeploy the `process-transcript-webhook` function.

## Files

| File | Change |
|------|--------|
| `supabase/functions/process-transcript-webhook/index.ts` | Add PDF text extraction for PDF attachments using `npm:pdf-parse`; add `extractTextFromPdfBytes` helper |

## Summary

- **Why it broke**: Ingest email was optional (Fireflies ignored it) + PDF format unsupported (manual forward was rejected)
- **Optional attendee fix**: Already deployed — new bookings work correctly
- **Old bookings**: Calendar events created before the fix still have the optional flag; users would need to recreate or manually update those events
- **PDF fix**: This plan adds PDF parsing so Fireflies transcripts (which default to PDF) are correctly processed going forward

