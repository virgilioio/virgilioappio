# Board 04 · Request card — the `answers` state

State 5 of the existing `<ReferenceCheckCard>` (same component, same slot below Scorecards). States 1–4 stay as they are; this fills in the answers rendering, upgrades `<RefereeRow>` to the full spec, and adds a client-shareable report.

## What changes

### 1. Referee row (shared component)
`RefereeRow.tsx` is upgraded in place — it stays the single row component for both the card and the future request detail page.
- Collapsed row: 30px avatar coloured by status (`on_hold` orange, `bounced` red, else purple), name + relationship badge, `title · company`, **recommendation score** (`17px` Poppins, green ≥8 / amber below, with `/10`), `<RefereeStatus>`, rotating chevron.
- Expanded row: lilac frame `#D7C5FB` + `#FAF8FF` tint, then a two-column key-value grid via a new `<KeyValueRow>`: Email · Worked together (`period`) · Status with timestamp (from `submitted_at` / `opened_at` / `invited_at` / `declined_at`) · Would rehire — `—` when absent.
- Hold note block (amber, `pause` icon) rendering the candidate's note verbatim in quotation marks, attributed to the candidate.
- Free-text answers only for `submitted` / `logged`, keyed off that referee's own `answers`, labels resolved from `template_snapshot.questions` (never the live template), skipped answers omitted. Score / would-rehire / employment questions are not repeated in the free-text list.
- Per-row actions behind a `showActions` prop: exactly one first action — `Release & send` (on hold, primary) / `Request a replacement` (bounced, primary) / `Resend email` (secondary) — then `Log by phone instead` and `Open referee link`. Per your answer, `Open referee link` renders only when that referee's link was minted in this tab (session store extended to key by referee id); it is omitted otherwise rather than rotating a live token.
- Expansion becomes controlled (`expanded` + `onToggle`) so the card can enforce one-open-at-a-time; the card opens the first referee by default.

### 2. Gio summary block
New `GioSummaryBlock.tsx` — lilac (`sparkles`) when clean, amber (`flag`) when flagged, `Gio summary` title, meta `Updated … · N of M in`, one prose paragraph, and compact flag badges (contradiction / self-assessment gap / soft signal) with counts only, zero counts omitted and pluralised. It reads `request.flags` and an optional `gio_summary` object. There is no analysis layer today, so with no prose the block renders nothing at all — no placeholder, no skeleton.

### 3. The card, answers state
`ReferenceCheckCard.tsx` gets an explicit `answers` branch: Gio summary → referee rows (one expanded at a time, `showActions`) → footer. The existing "what was sent" detail rows stay for `awaiting_referees` only, so the answers state reads as results rather than logistics. Header keeps the derived `<RefStatus state flagged size="xs">` and the counts string from `status.ts` (unchanged — `on_hold` already excluded from the denominator; no percentages anywhere). Footer for this state: `Resend to candidate`, `Log a phone reference`, `Share report`, and `Cancel request` pushed right as `danger` with a confirm dialog. Nothing disabled.

### 4. Share report (client-facing link)
- Migration: `share_token_hash`, `share_expires_at`, `share_created_by` on `reference_requests` (no new table, no new grants beyond the existing ones).
- New edge function `reference-report`: authed `mint` action (hashes a fresh token, returns the URL) and a public `resolve` action that returns a **client-safe** payload only — referee names, relationships, employment verification, scored answers and non-internal free text. Gio flags, the summary prose, internal-only questions, hold notes and candidate self-assessment are excluded server-side, so the exclusion cannot be lost in the UI.
- New public route `/reference-report/{token}` rendered with the existing `PublicPageShell` + `AgencyBrand` chrome (agency branding, "Recruitment software by Gio" footer), reporting splash-ready like the other public reference pages.
- `Share report` in the footer mints the link and opens a small dialog with the URL, expiry, and copy button.

### 5. Cancel confirm
`Cancel request` gains an AlertDialog confirm (the only confirm in this module), then runs the existing cancel mutation → card returns to state 1 with the cancelled note.

## Technical notes
- Files edited: `src/components/references/RefereeRow.tsx`, `ReferenceCheckCard.tsx`, `CandidateReferenceCheckSection.tsx`, `src/lib/references/sessionLinks.ts`, `src/App.tsx` (route).
- New: `GioSummaryBlock.tsx`, `KeyValueRow.tsx`, `ShareReportDialog.tsx`, `src/pages/PublicReferenceReport.tsx`, `supabase/functions/reference-report/index.ts`, one migration.
- No change to state derivation: no `flagged` state is added, `resolveCardState`/`countReferees`/`formatCounts` stay the single source. Release & send remains the only path that contacts a held referee (the existing `reference-request-actions` gate is untouched).
