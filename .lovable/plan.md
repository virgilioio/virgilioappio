# Flow E · Review — four recruiter screens

Composes what already exists (`RefStatus`, `RefereeTrack`, `countReferees`/`formatCounts`/`refPredicates`, `RefereeRow`, `Answer`/`AnswerList`, `GioSummaryBlock`, `LogPhoneReferenceDialog`, `ShareReportDialog`) into the module list, the request detail page, and the candidate-level references screen. No new data model, no new gating, no redefinition of those primitives.

## Route note (one deviation from the spec)

`/references/:token` is already taken by the **public candidate** referee-submission page (registered outside auth in `App.tsx`). Two dynamic siblings at the same depth would collide, so the request detail lands at:

- `/references/requests/:requestId` — detail (E.2)
- `/candidates/:candidateId/references` — candidate-level list (E.4)

Both are static-segment-disambiguated, so the public link keeps working. Breadcrumbs, row clicks and card "Open" buttons all point at the new path.

## E.1 · Module list (`/references`)

Replaces today's placeholder empty state in `src/pages/References.tsx`.

- New hook `useTenantReferenceRequests()`: all requests for the tenant with their referees, plus candidate (name, role, avatar), job, client and template names — one fetch per table, joined in memory (the pattern used elsewhere for non-tenant child tables). Realtime is not added here; the list refetches on focus.
- Per row the state is **derived** with `deriveState(referees, required)` and counts with `formatCounts` — the stored `state` column is not trusted for display, exactly as the card does.
- `PageHeader`: title, kicker, `count` = total, meta `Across N jobs` plus an amber `#B45309` span `N need attention` (only when > 0), actions Templates + New request.
- Filter bar: segmented view tabs (All / Needs attention / Waiting / Complete) whose labels, counts and row filter all come from the existing `refPredicates` object in `src/lib/references/status.ts` — no second counting path, no hardcoded numbers. `Needs attention` already includes `flagged`.
- Three filter pills (Job / Client / Recruiter, defaults All / All / current user) as `FilterChipPopover`-driven chips styled to spec, plus a right-aligned 30px search that matches candidate **and** referee names.
- Table in a `Card padding={0}`: one shared grid string on header and rows — Candidate · Collected for · Template · Progress · Last activity · chevron. Progress is `RefStatus size="xs"` over `RefereeTrack width={54}` + counts text, with track and counts omitted when there are no referees. Row click navigates to the detail. No percentages anywhere.
- "Last activity" comes from the newest `reference_activity` row per request (single batched query).
- Empty state keeps the canonical Gio empty state when there are no requests at all; a filtered-empty variant when a tab/filter yields nothing.

## E.2 · Request detail (`/references/requests/:requestId`)

New `src/pages/ReferenceRequestDetail.tsx` inside `ReferencesShell`.

- Header: candidate name, clickable breadcrumb `Reference checks → {name}`, meta `RefStatus` + counts, actions Log by phone / Share report / Resend (all reuse existing hooks and dialogs, none disabled).
- New `<ProvenanceLine>` component (`src/components/references/ProvenanceLine.tsx`): job · client · stage · recruiter · collected date, dot-separated, reused by E.4 and available to the card.
- Two-column grid `1fr / 320px`.

**Left column**

1. `GioSummaryBlock` at detail scale (13px prose) — renders **nothing** when there is no analysis, and gains a flag-card list: one card per entry in `request.flags` with its own tile/icon (`git-compare` / `scale` / `ear`) and the stored specifics. No flag data is invented client-side; if `flags` is empty the section is absent.
2. Referees: section head with `Request a replacement`, then the shared `<RefereeRow expandable>` list with the frozen snapshot's questions and the candidate's `self_assessment` — one row open at a time. Not duplicated, not restyled.
3. New `<ScoredAnswersTable>` (`src/components/references/ScoredAnswersTable.tsx`): grid `1.5fr / 96px / N×1fr`, Self column first (lilac tint only on rows that have a self-score), one column per referee **including held ones** (a full column of em dashes). Scale-aware thresholds (1–5 vs 1–10 recommendation), amber `vs {mean}` on a self-gap ≥ 2 using the same helper the flag threshold uses. Rehire rows render a `Badge size="xs"`. Live text never lighter than `#8B8F9E`.

**Right column**

1. Request panel — template, requested by, sent, candidate link expiry, consent timestamp, retention period (all already columns on `reference_requests`).
2. Privacy note (`eye-off`) — referee answers are internal.
3. Activity timeline — new hook reading `reference_activity` for the request, ordered ascending, rendered with the connector line, tone-coded dots and `{actor} · {when}`. Never truncated, no "show more".

## E.3 · Log a phone reference

Refit of the existing `LogPhoneReferenceDialog` (mutation untouched):

- Eyebrow `{candidate} · Reference check`, spec title/subtitle, footer badge `Marked recruiter-captured` beside Cancel / Save reference.
- Referee section becomes `Which referee?` (select over this request's referees, **pre-filled** when opened from a row) + `Spoke on` date-time; picking an existing referee updates that row instead of inserting a duplicate, otherwise it inserts as today.
- Employment verification captured as job title + dates, capture only — no verdict.
- Questions use the existing `QuestionInstrument` set, so a logged reference is comparable with a submitted one.
- Writes a `reference_activity` row naming the recruiter; available at every request state including awaiting-candidate.

## E.4 · Candidate profile — references (`/candidates/:candidateId/references`)

New `src/pages/CandidateReferences.tsx` — outside any job, one card per check.

- Header: `References`, breadcrumb `Candidates → {name} → References`, meta `N checks collected · Follows the candidate across every job`, primary `Request references` (reuses `RequestReferencesSheet`).
- Card: 32px black glyph tile with `RefGlyph`, `RefStatus` + counts + an age chip (`Current` green when < 3 months, else neutral `N months old`), the provenance line, and a secondary `Open` to the detail. The current (newest) check gets the lilac `#D7C5FB` border.
- Candidate-ownership footnote below the list.
- Linked from the existing candidate profile so it is reachable.

## Share report

Server behaviour is already correct (`reference-report` strips flags, summary, internal questions, self-assessment, hold notes and the timeline). This pass only adds the existing `ShareReportDialog` trigger to the E.1 row menu and the E.2 header — no change to what the link exposes.

## Technical notes

- New files: `src/pages/ReferenceRequestDetail.tsx`, `src/pages/CandidateReferences.tsx`, `src/components/references/ProvenanceLine.tsx`, `ScoredAnswersTable.tsx`, `ReferenceRequestsTable.tsx`, `ReferenceActivityTimeline.tsx`, plus list/detail/activity hooks in `src/hooks/useReferenceRequests.ts` (or a sibling `useReferenceList.ts`).
- Edited: `src/pages/References.tsx`, `src/components/references/LogPhoneReferenceDialog.tsx`, `src/App.tsx` (two authenticated routes), and the candidate profile link-out. `Header.tsx` section matching already covers `/references*`, so the Requests/Templates top-bar tabs persist on the new screens — no second header, no in-page pill tabs.
- Untouched: `status.ts` predicates and counts, `RefereeRow`, `Answer`/`AnswerRow`, `answers.ts`, every mutation, RLS and the edge functions. No migration.
