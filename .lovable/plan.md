# In-Job Candidate Profile Redesign

Rebuild the layout of `CandidateProfileSheet.tsx` (the sheet that opens when clicking a candidate inside a job) to match the new mockup. Pure presentation work — all data hooks, mutations, permissions, and downstream sheets (Schedule, Reject, OfferComposer, Scorecard, etc.) stay wired exactly as today.

## What changes

### 1. Top bar (above hero)
- Left: `← Back to job` ghost link.
- Center: breadcrumb `Jobs › [Job title] › Candidates`.
- Right: paginator `N of M` with prev/next chevrons (replaces today's Previous/Next buttons in the SheetHeader).

### 2. New Hero Card (replaces current `SheetHeader` + `CandidateNameCard` block)
A single rounded white card (`rounded-2xl border border-virgilio-border shadow-sm p-6`) containing three stacked rows:

**Row A — identity**
- Large circular avatar (96px, brand purple fallback with initials).
- Name as `text-h1` Poppins 600 with purple period.
- Heart favorite toggle (existing logic).
- Current-stage pill (existing `Badge` tone="purple", dot).
- Subtitle line: `Applying for <job link> · Source: <source> · Applied <relative>` using `text-body-sm text-text-secondary`.
- Far right: AI FIT score chip — small bordered box, label "AI FIT" caps, score in Poppins 600 28px purple. Reuses existing `useCandidateFitInsights` score; hidden when no score.

**Row B — stage progression strip**
A horizontal flex of equal-width stage cards (one per `JobStage`, scroll-x on mobile). Each card is `rounded-xl px-4 py-3` with:
- `completed` → `bg-pastel-green` + filled check icon, label + `✓ Passed in Xd`.
- `current` → `bg-citron-noir text-cream` (solid black), filled dot, label + `In stage · day N of M`.
- `pending` → `border border-dashed border-virgilio-border bg-transparent text-text-tertiary`, hollow circle, label + "Upcoming".
Driven by existing `useJobHiringPlan` + association status. No new data.

**Row C — action bar**
Single flex row, space-between:
- Left cluster (primary actions, in order): `Advance to <next stage>` (variant `primary`, arrow icon), `Submit scorecard` (secondary), `Schedule` (secondary), `Email` (secondary). All `size="md"`.
- Right cluster: `Create offer letter` (variant `purple`, only when `associationStatus === 'offer'` OR stage type is offer — same condition as today's offer composer trigger), `Reject` (variant `danger`), `⋯` ellipsis menu containing overflow actions (Move to job, Download profile, Edit, Delete, etc. — same items already in current header menu).
All click handlers map 1:1 to existing functions in the file.

### 3. Tabs (replaces current left tab strip)
Reuse the exact `TabsList` styling pattern from `JobDetail.tsx` so it visually matches Job Profile:
`Job overview | Resume | Overview | Scorecards <count> | Activity <count> | Comments <count>` with count badges.
- `Job overview` = today's `job` tab content.
- `Resume` = today's `resume`.
- `Overview` = today's `overview` (work exp / education / skills).
- `Scorecards`, `Activity`, `Comments` = pulled out of today's right sidebar tabs into top-level tabs.
- `Insights`, `Reminders`, `Chat`, `Emails` move into the right column (see §4) or are folded in.

### 4. Two-column body (inside each tab)
Grid `lg:grid-cols-[1fr_360px] gap-6`. Same grid for every tab.

**Left column** — primary content for the active tab, organized in cards (`rounded-2xl border-virgilio-border shadow-sm`). Each card has a header row (title in `text-h3` Poppins 600 + small action like "Open stage ↗" / "Add" / "Compare") and a body. Examples for `Job overview`:
- `Current stage · <name>` card → "Next event" mini-card + "Interviewers" mini-card side by side (existing data).
- `Scorecards` summary card → list of submitted scorecards (existing `ExpandableScoreDisplay`).

**Right column — sticky** (`sticky top-6`):
- `QUICK ACTIONS` card — repeats the four primary CTAs as full-width stacked buttons (Advance / Submit scorecard / Schedule / Create offer / Reject). Same handlers.
- `APPLICATION` card — labeled rows: Applied, Source, Comp ask, Open to, Work auth (already collected by `CandidateApplicationResponses` / candidate fields). Two-column label/value layout, dividers between rows.
- Below: existing Reminders / Insights small cards (kept, restyled to same card shell) when relevant.

Banners (`RejectionStatusBanner`, `OfferStatusBanner`, `HiredStatusBanner`) sit between the hero card and the tabs — unchanged logic.

## What does NOT change
- Data fetching, mutations, permissions, restricted-viewer gating.
- Sheet container behavior (`Sheet` + `SheetContent side="right" w-[96vw]`), URL `?candidate=` syncing in `JobDetail.tsx`.
- All downstream dialogs/sheets (Schedule, Reject, OfferComposer, ScorecardSheet, EmailComposer, Edit form).
- Mobile: hero card stacks; stage strip scrolls horizontally; right column drops below tabs (no sticky).

## Files

**Heavily edited**
- `src/components/candidates/CandidateProfileSheet.tsx` — replace JSX from line ~1051 (`<Sheet ...>`) downward; keep all hooks/handlers above. Extract sub-pieces into new files to keep this manageable.

**New components** (under `src/components/candidates/profile/`)
- `ProfileTopBar.tsx` — back link, breadcrumb, paginator.
- `ProfileHeroCard.tsx` — identity row + AI FIT chip.
- `ProfileStageStrip.tsx` — stage cards (completed/current/pending visual states).
- `ProfileActionBar.tsx` — primary + secondary + overflow menu.
- `ProfileQuickActionsCard.tsx` — right-column quick actions.
- `ProfileApplicationCard.tsx` — right-column application meta.
Each receives data + handlers as props (no new hooks).

**Touched lightly**
- `src/pages/JobDetail.tsx` — pass `totalCount` / `currentIndex` to the sheet for the `N of M` paginator (data already exists from candidate list).

## Out of scope
- Standalone (non-job) candidate profile (`UniversalCandidateProfileSheet`, `IndependentCandidateProfileSheet`) — not redesigned in this pass.
- Any backend, RLS, or hook changes.
- Adding/removing tabs beyond the six in the mockup.
- Insights/Chat panels: kept as-is functionally, just relocated to right column or merged into Activity tab if obvious; no AI behavior changes.

## Verification
After implementation, open `/jobs/:id?candidate=:cid` at 1347×875 and 390×844, verify hero card matches mockup (avatar size, AI FIT chip, stage colors), tabs match Job Profile chrome, action bar shows correct buttons per status (active vs offer vs rejected), and all existing handlers still fire (Advance, Schedule, Email, Reject, Create offer, ⋯ menu items).
