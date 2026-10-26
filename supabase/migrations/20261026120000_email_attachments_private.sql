-- Email attachments are private to the server (Allan, 2026-10-26).
-- Applied from a desktop chat with a scoped token: it removes two policies.
--
-- The bucket email-attachments holds the files the Gmail sync saves from
-- candidate mail ({mail_identity_id}/{gmail_message_id}/{file}). Two policies
-- let any signed-in user, externals included, read every file and upload
-- into the bucket. Nothing in the browser touches the bucket: the Gmail sync
-- (sync-gmail-messages) saves, email-attachments-sweep and candidate erasure
-- (_shared/privacy.ts) remove, and download-email-attachment checks that the
-- file is in the caller's own mailbox before it hands out a signed link. All
-- of them use the service role, which these policies don't govern. So the
-- two go and nothing replaces them.

drop policy if exists "Authenticated users can read email attachments" on storage.objects;
drop policy if exists "Service role can upload email attachments" on storage.objects;
