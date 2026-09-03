# Activity feed: stage moves + email previews

## What's already there

Stage changes **are** recorded. The feed holds 1,551 `candidate_stage_changed` entries, each carrying the from-stage, to-stage, job and association in its metadata. Emails are recorded too — 449 sent, 62 received — but the row only shows a one-line title ("Email sent: Next Steps…"), so nothing of the message itself is visible.

## 1. Stage moves — make the row read like a move

Keep the logging exactly as it is; improve only how the row renders. Instead of the flat sentence, show the two stages as a move: `Recruiter Screening → Hiring Manager Interview`, with the job name as a quiet second line. Any note the mover left keeps its existing quoted block.

## 2. Emails in the feed, with a preview

Email rows (sent and received) get a real body:

- **Collapsed (default):** subject in bold, the counterparty address, and a two-line plain-text preview of the message body.
- **See more** expands the full message body inline — quoted history and signatures trimmed off, same treatment the Emails tab uses — and the trigger flips to **See less**.
- Direction is visible at a glance: sent vs received (received rows read "replied").
- If the message has attachments, a small paperclip + count sits under the preview.
- If the body can't be resolved (older activity with no linked email), the row stays as it is today — no empty preview box.

Bodies are not duplicated into the activity record. The feed resolves them from the existing email records using the `email_log_id` already stored in each email activity's metadata, in one batched read for the visible rows.

## Technical notes

- `src/hooks/useActivityFeed.ts` — after the `get_candidate_activities` RPC returns, collect `metadata.email_log_id` from email activities and fetch `subject, body_html, body_text, snippet, from_address, to_addresses, direction, attachments` from `email_logs` in a single `.in()` query; attach as `emailBody` on those activities. Same query key, same enabled gate.
- `src/components/candidates/ActivityFeedItem.tsx` — add two branches: a stage-move header (from → to, job subline) and an email block using `splitEmailQuote()` from `src/utils/emailQuoteSplit.ts` for the visible portion, plus the existing HTML sanitizer for expanded content. Expansion is local `useState`, collapsed by default; text sizes/tokens follow the current feed row.
- No schema change, no new logging, no RLS change. `email_logs` is already readable under existing policies by the same users who see the feed; rows the user can't read simply return no body and fall back to today's rendering.
