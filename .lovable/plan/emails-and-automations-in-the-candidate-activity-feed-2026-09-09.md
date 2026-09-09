# Emails and automations in the candidate Activity feed

The Activity tab becomes the full chronological record: every email appears as a compact card you can expand, and anything the system sent by itself is clearly marked as automated. The Emails tab is untouched.

## What changes for you

- **Emails in the timeline.** Each sent or received email shows a small card under the entry: who it went to (or came from), the subject, and a two-line preview. "See more" opens the full message in paragraphs; "Open in Emails" jumps to that message in the Emails tab. For sent mail, the expanded card also shows open tracking when we have it.
- **Only the new words.** Quoted reply chains and signatures are stripped, so the card shows what was actually written this time.
- **Automated events are obvious.** Automated emails, triggered automations, skipped automations, sequence enrolments and completions each get an amber "Automated · {name}" tag, a lightning icon, and an optional step line like "Step 2 of 3 · 24h before interview". They are credited to Gio, never to the recruiter who built the automation.
- **Sidebar.** A new **Automations** filter group sits after Emails with its live count. In Stats, the single "Touches" row splits into "Emails sent · N by hand" and "Automated · N events".

## Technical notes

**Data**
- Migration: add five values to the `activity_type` enum — `candidate_email_automated`, `automation_triggered`, `automation_skipped`, `sequence_enrolled`, `sequence_completed`.
- No email bodies copied into `activities`. `useActivityFeed` already joins `email_logs` by `metadata.email_log_id` for the visible rows; extend that select with `opened_at` and keep it the single source. Build the `ActivityEmail` shape (direction, to/from, subject, paragraphs, optional pre-formatted `opened`) in the hook, splitting the plain body on blank lines after `splitEmailQuote()` removes quoted history and signature.
- `ActivityAutomation` (`name`, optional `step`) is read from activity `metadata.automation`. Both payloads can coexist on one event.
- `src/lib/activityRegistry.ts`: map the two existing email types to `emails`; add a new `automations` category holding all five automation types (automated emails included); register `Zap` / `ZapOff` glyphs with the yellow tone, reserved for these types only. Unknown types still fall through to "Other events". Export `isAutomated(event)` — true when the event carries an `automation` payload or its type is one of the five — and use it everywhere instead of inline type comparisons.
- `send-user-email`: accept an optional automation context in the request. When present, log `candidate_email_automated` with `metadata.automation = { name, step }` and attribute the actor to Gio rather than the invoking user. `process-automation-emails` passes that context (automation name, step position/total, trigger description) when it invokes the send.

**UI**
- New `src/components/candidates/ActivityEmailCard.tsx`: 1px `#E7E8EE` / radius 8 / white / overflow hidden. Header strip `8px 12px`, hairline `#F1F0EC`, background `#FBFAFF` received / `#FCFCFA` sent, 11px send/inbox icon, "To"/"From" `#8B8F9E`, truncated address `#5A6072`. Body `10px 12px 12px`: subject Inter 12.5/600 `#1F2230`; preview Inter 12.5 `#5A6072` line-height 1.6 clamped to 2 lines with paragraphs joined by a space; "See more" button Inter 11.5/600 `#6F3FF5` with chevron. Expanded: paragraphs as blocks with 10px gaps, "Open in Emails" (`arrow-up-right`, Inter 11.5 `#5A6072`), and for sent mail the `opened` line with `eye` icon 11px `#8B8F9E`. Expansion is local per-card state, not persisted.
- `ActivityFeedItem.tsx`: replace the current inline email block with this card; add the amber `Automated · {name}` pill (`#FEF3C7` / `#8A5306`, radius 999, Inter 10.5/600, `2px 7px 2px 5px`, 9px zap) after actor/timestamp when `isAutomated`, plus the `automation.step` subline (Inter 11px `#8B8F9E`). Row icon, title, actor and timestamp stay as they are.
- "Open in Emails" needs a callback threaded from `CandidateProfileSheet` through `ActivityFeedList` → item: switch `activeTab` to `emails` and scroll the matching message into view using the existing highlight/scroll utility.
- `CandidateProfileSheet.tsx`: category counts already derive from the registry, so Automations appears automatically once mapped; replace the `touchesFromUs` stat with the two new counts. `SidebarRouter.tsx` `ActivitySidebar` stats props gain `emailsByHand` and `automatedEvents` rows in place of "Touches".

No changes to the Emails tab, no reply/forward actions on the card, no schema columns added beyond the enum values.
