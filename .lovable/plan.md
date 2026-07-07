## Goal

Unify bulk email into the same docked `MinimizableEmailComposer` used for 1:1 candidate emails, so recruiters get one consistent composer regardless of recipient count. Delete the legacy `BulkEmailDialog` centered modal.

## Root cause

`src/pages/JobDetail.tsx` opens `BulkEmailDialog` (a shadcn `<Dialog>` with its own subject/body editors, template picker, scheduler, and send button) whenever the user bulk-emails from the Application Review table. Meanwhile every 1:1 path (`CandidateProfileSheet`, `CandidateOfferDetails`, `BookingDetailsDialog`, `IndependentCandidateProfile`) uses the dark-header `MinimizableEmailComposer` wrapping `EmailComposer`. Two divergent UIs, two feature sets.

## Plan

### 1. Extend `EmailComposer` (`src/components/candidates/EmailComposer.tsx`) with a bulk mode

Add optional props (all backward-compatible; single-email callers unaffected):

- `bulk?: { associationIds: string[]; jobId: string }` — when present, activates bulk mode.
- Keep every existing prop and behavior for the 1:1 path.

Bulk-mode differences inside the composer:

- On mount, run the same association fetch that `BulkEmailDialog` did (embedded email + candidate names), split into "with email" vs "without email", store both.
- Recipient row: replace the To chip editor with a read-only recipients summary chip: `"N recipients"` that opens a popover listing candidate names. Show a Gio-styled inline warning strip (not a big Alert) when `withoutEmail.length > 0`: `"M skipped — no email address"`.
- Keep CC/BCC hidden in bulk mode (personalization + CC/BCC is out of scope; matches current bulk dialog which also lacks CC/BCC).
- Reuse the existing `SubjectTemplateEditor` + `BodyTemplateEditor` + template picker + AI Draft + Booking Link + attachments UI exactly as-is. Placeholders already work identically.
- Footer: add a `Send / Schedule` split control matching the app style guide (`<SplitButton>` from the buttons foundation). Primary action = `Send N emails`; dropdown reveals `Schedule for later…` which opens a `DatePickerVirgilio` + hour select popover (inline within the footer, not a nested modal).
- Replace the single-email `useSendEmail().mutate` with `useBulkSendEmail().sendBulkEmailAsync` when `bulk` is set. Wire its `progress` into a slim hairline progress bar rendered just above the footer during send (keeps the composer chrome intact — no big centered progress block).
- On success call `onSuccess` (which closes the docked panel via `MinimizableEmailComposer`'s handler), preserving current behavior.

### 2. Extend `MinimizableEmailComposer` (`src/components/candidates/MinimizableEmailComposer.tsx`)

- Add pass-through `bulk?: { associationIds: string[]; jobId: string }` prop and forward to `EmailComposer`.
- Header title logic: when `bulk` is set, title = `New email · ${associationIds.length} recipients`; sub-line = job title if available (fetch already present in JobDetail; pass down as `bulkJobTitle?: string` for the header only). Minimized strip mirrors the same text.
- Everything else (minimize, close, scrim, dark header, template chip) unchanged.

### 3. Swap the JobDetail integration (`src/pages/JobDetail.tsx`)

- Remove the `BulkEmailDialog` import and its `<BulkEmailDialog … />` render (around line 1557).
- Remove `showBulkEmailDialog` state; replace with `bulkEmailState: { open: boolean; associationIds: string[] } | null`.
- The existing bulk-email trigger (line 1163) already knows the selected candidate IDs. Reuse `BulkEmailDialog`'s association-fetching logic inside the composer instead of pre-fetching here — trigger simply passes `candidateIds` down and the composer resolves them to associations. (Simpler: pass `candidateIds` + `jobId` and let the composer fetch associations, matching current behavior.)
- Render `<MinimizableEmailComposer bulk={{ candidateIds, jobId }} … />` in place of `<BulkEmailDialog />`. Same z-index and minimize behavior users already know from 1:1 emails.

Correction on the prop shape above: pass `candidateIds` (not `associationIds`) since JobDetail's bulk selection is candidate-scoped; the composer resolves associations internally, matching what `BulkEmailDialog` already does.

### 4. Delete the legacy dialog

- Remove `src/components/candidates/BulkEmailDialog.tsx`.
- `useBulkSendEmail` stays — it's the send engine, now called from `EmailComposer`.

### 5. Verification

- `bunx tsgo --noEmit` clean.
- Manually: on `/jobs/:id`, select ≥2 candidates → "Email" → dark-header docked composer opens (bottom-right), title reads `New email · N recipients`, minimize/close work, template picker + AI Draft + Booking link + attachments all render, `Send` and `Schedule for later` both fire the bulk flow, progress hairline animates, warning strip appears if any selected candidate lacks an email. Confirm 1:1 email flows (`CandidateProfileSheet` reply/forward) are unchanged.

## Out of scope

- Rewriting `useBulkSendEmail` or the placeholder resolver.
- CC/BCC support in bulk (would need per-recipient CC UX — separate feature).
- Any changes to `Candidates.tsx` (its bulk-email button is still a `toast("coming soon")` placeholder; wiring it up to the same composer is a trivial follow-up but not requested here).

## Technical notes

- `<SplitButton>` and `<DatePickerVirgilio>` are already the standardized primitives per the style guide memory — no new UI kit work.
- The `bulk` prop is intentionally a discriminated object rather than a boolean so future callers (e.g., Candidates page) can pass their own resolver without JobDetail-specific assumptions.
- Progress hairline goes inside the composer's footer area, above the send button row — keeps chrome consistent with the docked panel's fixed footer pattern.
