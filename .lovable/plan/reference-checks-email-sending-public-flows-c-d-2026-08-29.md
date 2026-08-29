# Reference Checks — Email sending + public flows C & D

Three deliverables: the email layer, the candidate referee-submission page, and the referee questionnaire page. Flow E (review list) and the Gio analysis layer are out of scope, but every row written here is shaped so Flow E can read it later.

## Current state (verified)

- `reference_requests`, `reference_referees`, `reference_activity`, `reference_templates` all exist with the columns this pass needs (`candidate_token_hash`, `candidate_link_expires_at`, `consent_recorded_at`, `self_assessment`, `template_snapshot`, referee `token_hash` / `link_expires_at` / `on_hold` / `hold_note` / `answers` / `status`).
- `useCreateReferenceRequest` inserts the request row and one activity row — **no email is sent today, and no token is minted**. That is why the test request never reached the candidate.
- Public-page precedents to follow: `/schedule/:shortCode` (PublicBookingPage) and `/c/chat/:token` (CandidateChat) — both outside the authenticated `Layout`.
- Token precedent: `_shared/chat-token.ts` (HMAC-SHA256 signed, only SHA-256 hash persisted, audit row on issue).
- Agency brand data: `tenants.name` + `careers_page_settings.logo_url`.

## Part 1 — Email layer (edge functions)

New shared module `supabase/functions/_shared/referenceTokens.ts`
- `issueReferenceToken({ kind: 'candidate' | 'referee', ... })` and `verifyReferenceToken(token)`, modelled on `chat-token.ts`: HMAC over `kind.tenant.request.subject.jti.exp`, hash stored in `reference_requests.candidate_token_hash` / `reference_referees.token_hash`, audit row on issue. No id, name, or email in the URL.

New shared module `supabase/functions/_shared/referenceEmail.ts`
- Renders both emails from the request's `template_snapshot` (never the live template), in the agency-branded card style already used by `chatInviteEmail.ts`/`memberInviteEmail.ts`.
- Placeholder resolution is strict: any unresolved `{{token}}` throws, the send is aborted, an activity row records the failure, and the recruiter sees the error. `estimated_minutes` = ceil(45s × visible question count), floor 3. `referee_count` = per-request override, else snapshot minimum. `expiry_date` formatted `3 Sep 2026`.
- From name = agency display name; From address = tenant sending address, else platform relay with the agency name preserved; **Reply-To = the requesting recruiter's address**.

New functions
- `send-reference-request` (authed): mints the candidate token, sends email 1, sets `state = 'candidate'`, `candidate_link_expires_at`, writes `candidate_email_sent` activity. Called by the existing Request references sheet.
- `reference-public` (public, no JWT): single token-resolving endpoint with actions — `resolve`, `save_draft`, `submit_candidate`, `save_answer`, `submit_referee`, `decline`. Every auth-shaped failure returns one identical `not_found` so tokens are non-enumerable; IP rate limit as in `chat-token-verify`.
  - `submit_candidate` creates referee rows, records `consent_recorded_at` and `self_assessment`, sets `state = 'referees'`, mints tokens **only for non-held referees**, sends email 2 to those, and writes the `candidate_submitted` + one `referee_held` activity per held referee. Held referees get no token and no email.
- `reference-reminders` (cron, `INTERNAL_FUNCTION_SECRET` gate like `process-automation-emails`): re-sends the same two templates on the snapshot cadence (candidate 3d then every 4d; referee 2d, max 3), with stop conditions submitted · declined · expired · cancelled · status changed · `on_hold`.
- `reference-retention-sweeper` (cron): purges referee PII + answers at `retention_expires_at`, purges declined referees at +30 days, and discards drafts + revokes tokens when a request is cancelled — so no printed promise is unimplemented.

Bounces: hard bounce → referee `status = 'bounced'`, activity row, `request.state = 'attention'`, no retry.

DB migration (small, additive)
- `reference_referees.draft_answers jsonb default '{}'` and `last_saved_at` for the referee autosave, plus `declined_at` and `pii_purge_at`; `reference_requests.cancelled_at`. Grants + RLS follow the existing reference-table policies; public writes happen only through the service-role edge function.

## Part 2 — Public shell (shared)

New `src/components/public/` — imports nothing from the authenticated app (no `Layout`, `AppHeader`, `PageHeader`).
- `PublicPageShell.tsx` — `#FAF8F3` page, header bar (agency brand left; page kind · divider · green shield "Secure link" right), content inset, 22px-radius lifted card (760px C / 720px D), footer with lock + footnote · Privacy · Report this link · "Recruitment software by **Gio**" (Gio's only appearance).
- `AgencyBrand.tsx` — three cases per board 05a: logo lockup with hairline divider; **wordmark (default)** at 19px Poppins 700; registered-name with suffix split onto a second line. No placeholder box, no monogram, never a Gio fallback.
- `PublicField.tsx` — the 38px / 9px-radius label + input/select control.
- `TerminalCard.tsx` — medallion + title + body + optional action/foot, with green/amber/neutral/red tones.
- Mobile: <760px full-width 16px-radius card, single-column grids, ≥44px touch targets, full-width submit.

## Part 3 — Flow C, candidate page

Route `/references/:token` → `src/pages/PublicReferenceSubmit.tsx` (registered above the authenticated routes; the static `/references` and `/references/templates` app routes still win by React Router's static-over-dynamic ranking). Document title `Add your references · {Agency}`.

Card contents, in order: header block (lilac eyebrow `{client} · {job}`, 25px h1 with spelled-out count and lilac period, three-fact body, expiry chip) → live "Before you start" checklist → self-assessment block (only when the snapshot has `ask_candidate_too` questions, rendered in the identical instrument the referees get) → numbered referee cards → consent block → submit row.

- Checklist re-evaluates on every keystroke/toggle and is the only submit gate — no red text, no validation summary.
- Referee card: number chip, "Referee n", Remove, 2-column fields from the snapshot's referee-field set with the label "Relationship to you", and a "Don't contact yet" toggle that amber-tints the card, adds the orange "Won't be contacted yet" badge, and reveals the optional note field.
- Submit line states the outcome live: `Ready to send — 2 referees will be emailed now, 1 held.`
- Terminal states (board 06): received (naming who was emailed and who is held), already submitted, expired, cancelled.

## Part 4 — Flow D, referee page

Route `/reference/:token` → `src/pages/PublicReferenceAnswer.tsx`. Title `A reference for {Candidate} · {Agency}`.

- Header: avatar, 22px h1 with lilac period, context sentence with the job title bolded, computed time chip.
- Privacy block high on the page, with the full five-answer paragraph and, beside the privacy-notice link, the **decline link — visible above every question**.
- Questions: mono zero-padded index, 14px Poppins label, answer area inset 26px. Controls per type: `rating_1_5` (52×42 buttons, legend on the first rating question only), `would_rehire` (three tinted full-width options), `long_text`, `employment_verification` (**always empty on load**), `recommendation_score` (1–10), and the shared field control for the rest. `section_header` renders as a caps label; `internal` questions never render.
- Footer: autosave note + "Finish later" + "Submit reference". Autosave on blur writes `draft_answers` and flips status to `in_progress` on the first save, so answers survive a reload.
- Terminal states (board 08): submitted, picked-up-where-you-left-off, declined, expired. Unknown tokens render the expired card verbatim; cancelled requests render the neutral withdrawn card.

## Notes

- Every unknown/invalid token is indistinguishable from an expired one.
- Referees marked `on_hold` are never tokenised, emailed, or reminded, and are excluded from the emailed count.
- Emails always resolve from `template_snapshot`; a template edit cannot change an in-flight request's wording.
