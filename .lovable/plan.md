
Goal
- Make inbound candidate replies reliably store body content and snippet, while preventing duplicates and preserving idempotency.
- Prioritize webhook path (`process-candidate-reply-webhook`) so rows shown on job-specific candidate pages have usable body content.

What I found in your current system
1) The webhook function is already receiving and inserting rows for `email.received`.
2) In the UI route you’re on, query is filtered by both `candidate_id` and `job_id`, so it only shows webhook rows tied to that job.
3) Those webhook rows currently have `body_text/body_html = null`, while separate Gmail-sync rows for the same RFC822 message often do contain body — but usually with `job_id = null`, so they are not shown in this view.
4) This is why email history appears empty even though body exists elsewhere in `email_logs`.
5) Existing schema already has `body_text`, `body_html`, and `snippet`; no schema migration is required.

Implementation scope
- Main fix: `supabase/functions/process-candidate-reply-webhook/index.ts`
- Optional resilience/readability fix: `src/hooks/useEmailLogs.ts` (or card rendering fallback) to avoid blank previews if body is absent but snippet exists.

Detailed implementation plan

1) Add robust body extraction helpers in webhook function
- Create utility helpers in `process-candidate-reply-webhook/index.ts`:
  - `extractBodyFromAnySource(source)` to check common fields in priority order:
    - text candidates: `text`, `body_text`, `body`, `content`, `raw`, nested variants
    - html candidates: `html`, `body_html`, nested variants
  - `stripHtmlToText(html)` for snippet fallback
  - `limitSize(value, maxChars)` to cap `body_text` and `body_html` at ~200KB equivalent char count (safe approximation with char length)
  - `buildSnippet(text, html)` to produce first ~120 chars from text first, then stripped html
- This directly satisfies your “common fields + fallback + snippet” requirements.

2) Keep payload-first strategy, then Resend fetch fallback
- First parse body from webhook payload (`payload.data`) using helper.
- If still missing body and `email_id` exists, call Resend:
  - `GET https://api.resend.com/emails/receiving/{email_id}`
  - `Authorization: Bearer ${RESEND_API_KEY}`
- Parse both possible response shapes:
  - root object (`{ html, text, ... }`)
  - wrapped object (`{ data: { html, text, ... } }`)
- Keep retries (already present), but improve observability:
  - log when `email_id` is absent
  - log attempt status and whether parsed text/html lengths were found
- Always continue and return 200 even on fetch failure; do not fail ingestion.

3) Replace duplicate “early return” with idempotent upsert-style behavior
Current issue:
- Existing code checks duplicate by `rfc822_message_id` and returns `duplicate` immediately, which prevents filling missing body and encourages stale empty rows.

Change behavior:
- For the same incoming message (`rfc822_message_id`, `direction='received'`, candidate/job scope), load existing row(s).
- If existing row found:
  - If existing body is missing and new body is now available → update existing row with body_text/body_html/snippet.
  - Also patch missing metadata fields (`thread_id`, `in_reply_to`, `references_header`, `job_id`, `candidate_id`, `organization_id`) when absent.
  - If body still unavailable, keep metadata update only and return success with reason `updated_metadata_only`.
- If no row found:
  - Insert new row as usual.
- This gives true webhook retry idempotency and avoids duplicate records.

4) Ensure snippet is always stored and useful
- Build snippet as:
  - text-first (`body_text`)
  - else stripped html
  - else null
- Normalize whitespace and trim.
- Use ~120 chars per your requirement.
- Do this both on insert and update paths.

5) Preserve “ignore internal sender copy” logic
- Keep current internal sender filter (good fix).
- Ensure this check remains before insert/update so outbound-to-ingest echoes don’t appear as received.

6) Optional UI safety net (small)
- In `useEmailLogs`/render path, if body is empty but snippet exists, use snippet instead of “No content”.
- This is optional but improves UX during transient cases.

7) No DB migration needed
- Columns already exist: `body_text`, `body_html`, `snippet`.
- No schema changes required.
- If we later want stricter dedupe at DB level, we can add a partial unique index strategy, but it’s not required for this fix.

Validation plan (end-to-end)
1) External inbound reply test
- Send a real reply from non-internal mailbox to ingest address.
- Confirm webhook row (with job_id) has non-null `body_text` or `body_html`, and snippet populated.
- Confirm candidate email history on `/jobs/...?...candidate=...` shows message content.

2) Retry/idempotency test
- Replay the same webhook payload (or send duplicate event) for same `message_id`.
- Confirm no duplicate row created for same inbound message in job context.
- Confirm missing body is updated if first attempt had only metadata.

3) Internal echo suppression test
- Send brand-new outbound email that includes ingest address.
- Confirm no extra received webhook row is created for internal sender.

4) Failure-tolerant behavior test
- Temporarily force Resend fetch failure (or simulate missing `email_id`).
- Confirm function still returns 200 and metadata row still saved.
- Confirm logs clearly state why body was unavailable.

Files to change
- `supabase/functions/process-candidate-reply-webhook/index.ts` (primary)
- `src/hooks/useEmailLogs.ts` (optional small UX fallback) OR `src/components/candidates/EmailHistoryCard.tsx` fallback handling

Expected result
- Inbound messages for candidate/job history will consistently show body content when available.
- If body is delayed/unavailable, row remains usable with snippet when possible.
- Webhook retries become safe and can enrich existing records instead of creating or preserving empty duplicates.
