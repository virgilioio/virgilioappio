
## Context

When a candidate applies via a public posting with Candidate Chat enabled, `public-submit-application` sends them a warm, on-brand invite email using `renderChatInviteEmail` in `supabase/functions/_shared/chatInviteEmail.ts` ("… from the hiring team wants to chat", avatar bubble, CTA, etc.).

When a recruiter later replies inside the in-app chat, we already do notify the candidate — `chat-notification-processor` picks up `candidate_recruiter_reply` rows from `chat_notification_queue` and sends an email. But that email uses the generic `createEmailTemplate` (blue blockquote, plain "Open chat" CTA), not the branded invite design.

So the answer to the question is: yes, we do send a notification, but it doesn't match the initial invite. This plan aligns them.

Scope: only the candidate-facing `candidate_recruiter_reply` branch. Recruiter-facing notifications (`recruiter_new_message`, `recruiter_handoff`) stay on the current internal template — different audience, different intent.

Out of scope: the `chat-send-email` path (that's a separate email-channel where the message *is* the email, not a notification about a new in-app message).

## Change

Single-file edit: `supabase/functions/chat-notification-processor/index.ts`

In `buildEmail`, replace the `candidate_recruiter_reply` branch so it renders through `renderChatInviteEmail` instead of `createEmailTemplate`:

1. Import `renderChatInviteEmail` from `../_shared/chatInviteEmail.ts` (dynamic or top-level).
2. Look up the sender (recruiter) profile from the last outbound message:
   - Get `sender_user_id` from the latest `direction='out'` message in the thread (fallback: any recruiter on the thread).
   - Fetch `profiles.first_name, last_name, title, avatar_url` for that user.
   - Derive `recruiter_initials` and pick a stable `recruiter_color` (e.g. hash of user id → existing brand palette; or reuse whatever helper the invite already relies on — default to Gio purple `#6F3FF5` if none).
3. Build merge vars:
   - `recruiter_first_name`, `recruiter_full_name`, `recruiter_title` (fallback: "Hiring team"), `recruiter_initials`, `recruiter_color`, `recruiter_avatar`
   - `candidate_first_name` from `ctx.candidate_name` (first token; fallback "there")
   - `job_title` from `ctx.job_title` (fallback "the role")
   - `recruiter_message` = the excerpt loaded via `loadLastExcerpt(..., "out")` (trim to ~600 chars to keep the email tight)
   - `chat_url` = the same `ctaUrl` currently built (magic-link path if a live token exists, else `/chat`)
   - `link_expiry` = "14 days" (matches token TTL used by the initial invite)
   - `support_email` omitted → defaults to `support@gogio.com`
4. Return `{ subject: rendered.subject, html: rendered.html, to: row.recipient_email }`. Keep `subject` from the template (not the current `"${company} replied"` string) so the design is fully consistent with the initial invite.

Nothing else changes: queue logic, cancel checks (read receipts, suppression, active candidate polling), retry/backoff, Resend send path, `EMAIL_DEFAULT_FROM`, cron cadence, and the recruiter-side branches stay exactly as they are.

## Notes

- Best-effort lookups: if the recruiter profile can't be resolved, fall back to `first_name = "The hiring team"`, `initials = "GT"`, default color, no avatar — so we never fail to send a notification just because attribution data is missing.
- Multi-message batches (`message_count > 1`) are naturally handled: the invite template renders `recruiter_message` as the body, so we still show the latest excerpt; no "+N more" line needed (the initial invite doesn't have one either — consistent by design).
- No DB migrations, no frontend changes, no config.toml changes.
