

# Show Email Attachments from Gmail

## Problem
When candidates reply with attachments, the Gmail sync function ignores them entirely. The `email_logs` table already has an `attachments` JSONB column, but it's never populated. The UI has no attachment display either.

## Plan

### 1. Update `sync-gmail-messages` edge function
- Expand the `GoogleMessage` interface to include `attachmentId` and `filename` on parts
- After extracting the email body, scan all MIME parts for attachments (parts with `attachmentId` or `filename` that aren't `text/plain`/`text/html`)
- For each attachment found:
  - Call Gmail Attachments API: `GET /gmail/v1/users/me/messages/{messageId}/attachments/{attachmentId}`
  - Decode the base64url data
  - Upload to Supabase Storage bucket `email-attachments` at path `{mail_identity_id}/{messageId}/{filename}`
  - Build metadata: `{ filename, mimeType, size, storageUrl }`
- Save the array of attachment metadata to `emailData.attachments`

### 2. Create `email-attachments` storage bucket (migration)
- Create a private bucket `email-attachments`
- RLS policy: authenticated users can read files under their mail identity path

### 3. Create `download-email-attachment` edge function
- Accepts `{ emailLogId, attachmentIndex }` or `{ storagePath }`
- Validates the user owns the email (via mail_identity ownership)
- Returns a signed URL or streams the file

### 4. Update `EmailHistoryCard.tsx` to display attachments
- Read the `attachments` JSON field from email data
- When attachments exist, render a small attachment list below the email body (paperclip icon, filename, size, download button)
- On click, call the download function or use a signed URL

### 5. Update `EmailHistoryCardEmail` interface
- Add `attachments` field to the TypeScript interface

## Files changed
- `supabase/functions/sync-gmail-messages/index.ts` — attachment extraction + upload
- `supabase/migrations/...` — create `email-attachments` bucket
- `supabase/functions/download-email-attachment/index.ts` — new function for secure download
- `src/components/candidates/EmailHistoryCard.tsx` — render attachments UI
- `src/hooks/useEmailLogs.ts` — ensure `attachments` is selected

## Scope
- Only syncs attachments for newly synced messages (existing emails won't retroactively get attachments until next re-sync)
- Attachment size limit: skip attachments > 25MB (Gmail's own limit)

