# Job page — visual parity pass (frontend only)

Replicates the screenshot 1:1. No backend, hooks, queries, or routes change. Reuses existing `Button`, `Badge`, `Avatar`, `TableToolbar`, `TableSearch`, `TableSegmented` primitives — no new components except a small candidate card variant.

## 1. Remove the outline around the underlined top tabs
File: `src/components/ui/tabs.tsx` (no change), `src/pages/JobDetail.tsx` (override).

The base `TabsList` ships with `bg-[#fffcf9] border border-virgilio-border/20 shadow-[var(--shadow-xs)] rounded-xl p-1.5`. The JobDetail override replaces `bg`, `rounded`, and `padding` but **does not strip `shadow` or the residual border color** — that is the visible outline.

Fix: extend the JobDetail `TabsList` className with explicit `shadow-none border-0 border-b` so only the bottom hairline remains. Also remove the `mb-4` and replace with `mb-3` to match screenshot spacing.

## 2. Section pills (Suggested / Application review / …)
File: `src/components/jobs/PipelineSectionTabs.tsx`.

Match the screenshot exactly:
- Drop the wrapping `rounded-2xl border border-virgilio-border bg-background p-1.5` container — the row sits flat on the page.
- Distribute pills with `flex w-full items-center justify-between` (no `flex-wrap`, no surrounding border).
- Pill height `h-10`, `rounded-lg`, label `text-[14px] font-medium` (active = `font-semibold`).
- Active background tones unchanged (`pastel-purple`, `pastel-yellow`, `pastel-blue`, `success/20`, `destructive/15`).
- Count chip: `h-6 min-w-6 rounded-md text-[12px] font-semibold tabular-nums px-1.5`. Inactive chip = `bg-muted text-text-tertiary`. Active chip per section: `bg-citron-noir text-cream` for application/recruiting/offers; `bg-success text-success-foreground` for hired; `bg-destructive text-destructive-foreground` for rejected; `bg-virgilio-purple text-white` for suggested.
- `Suggested` keeps the Sparkles icon.
- Hover for inactive pills: `hover:bg-[#FAFAF7]`.

## 3. Pipeline toolbar (search + view toggle + select + Add candidate)
File: `src/pages/JobDetail.tsx` and `src/components/jobs/PipelineOverview.tsx`.

Today the pipeline content is wrapped in a `<Card>` whose `CardHeader` shows a "Pipeline Overview" heading + Add Candidate button. That whole card has to go — the screenshot is flat.

- In `JobDetail.tsx`, replace the `<Card>…<CardHeader>…` wrapper around `<PipelineOverview/>` with a plain `<div className="flex flex-1 min-h-0 flex-col">`.
- Above the board, mount a single `TableToolbar` (already exists) with:
  - Left: `<TableSearch placeholder="Search in pipeline…" value={…} onChange={…} className="max-w-[320px]"/>` + an existing `Button variant="secondary" size="sm" icon={Filter}` showing "N filters" (wired to existing `FilterChipPopover` trigger; no new filter logic).
  - Right: `<TableSegmented>` with two options Board / List bound to `pipelineView`; a `<Button variant="secondary" size="sm" icon={CheckSquare}>Select</Button>` toggling `selectionMode`; and `<Button variant="primary" size="sm" icon={UserPlus}>Add candidate</Button>`.
- Delete the "Pipeline Overview" title + descriptive paragraph and the duplicate Add Candidate / Review Applications buttons inside the old `CardHeader`. The Application-Review CTA (`ClipboardCheck`) moves into the right side of the same toolbar, only when `pipelineSectionTab === 'application'`.
- Remove `showHeader` usage from the inner `PipelineOverview` so its own header/filter row never renders inside JobDetail (already false today; just clean the dead branch).

## 4. Stage columns (board)
File: `src/components/jobs/PipelineOverview.tsx`, `src/components/jobs/CandidateCard.tsx`.

Column shell:
- Remove the `rounded-xl border border-virgilio-border bg-background p-2` wrapper around the droppable area. Columns are flat: just the header row + a vertical stack of cards + an "Add candidate" dashed button at the bottom.
- Header row: keep the colored dot + name + small count, drop the `…` actions button (or shrink to `h-6 w-6 ghost` only on hover). Bold weight `font-semibold text-[14px]`.
- Empty column: replace the "No candidates in this stage" text with a single full-width dashed placeholder block matching `DroppableDealStage` styling — `min-h-[120px] rounded-xl border border-dashed border-virgilio-border/60`.
- After the card list, render a sticky-bottom dashed "+ Add candidate" `<button>` (plain, full-width, dashed border, `text-text-tertiary text-[13px]`, hover → `text-text-primary border-virgilio-border`). Wire to `setShowAddCandidate(true)` via a new `onAddCandidateClick` prop on `PipelineOverview` already present at the page level.

Candidate card (`CandidateCard.tsx`) — restyle to match mockup:
- Card: `rounded-xl border border-virgilio-border bg-white p-3 shadow-none hover:shadow-[var(--shadow-xs)]`.
- Top row: 32px circular `Avatar` with initials (purple fallback already exists) on the left; right side stacks `candidateName` (bold 13px) and a one-line subtitle "`{role}` · @`{company}`" in `text-text-tertiary text-[12px]`. Favorite heart sits top-right (`absolute top-2 right-2`) when `isFavorite`.
- Bottom row: left side AI-fit pill `<Sparkles className="h-3 w-3 text-virgilio-purple"/> {aiFitScore}` (Poppins tabular-nums 12px). Right side time chip — reuse existing `timeInStageLabel` with a clock icon — colored per `timeBadgeVariant` (red for ≥10 d, yellow 5-9 d, default neutral). When the candidate has a "Due tmrw"-style status, show a small pink badge (`tone="pink" size="xs"`) instead of the time chip.
- Drop the existing per-card supabase `candidateStatus`/`nextInterview` queries from the visual? **No** — keep the queries, only restyle the rendered output (no backend change). The status badge collapses to the pink chip slot on the bottom-right.

The role/company subtitle is read from existing `assoc.candidate_role` / `assoc.candidate_company` fields if available; otherwise fall back to a single empty line — no new fetch.

## 5. JobHero action buttons (top-right)
File: `src/components/jobs/JobHero.tsx`.

- Bump size from `sm` → `md` for all four (Share, View posting, Add candidate, More). This raises height to 34px (`h-button-md-v2`) matching the mockup proportions and uses the Gio default radius `rounded-lg`.
- Force the primary's text white explicitly: `<Button variant="primary" size="md" icon={UserPlus} className="text-white [&_svg]:text-white" …>Add candidate</Button>`. (Defensive: protects against any inherited `text-foreground` from the surrounding header even though the variant already declares `text-background`.)
- "More actions" stays `iconOnly` but at `size="md"` so all four sit on the same baseline.

## Files touched
- `src/pages/JobDetail.tsx` — TabsList override, removal of pipeline `Card` wrapper, new `TableToolbar` mount, prop wiring.
- `src/components/jobs/PipelineSectionTabs.tsx` — drop outer border, evenly spaced pills, font/size pass.
- `src/components/jobs/PipelineOverview.tsx` — remove column shell border, dashed empty state, dashed bottom Add-Candidate, prop for add-candidate handler.
- `src/components/jobs/CandidateCard.tsx` — visual restyle (avatar, subtitle, AI-fit + time row).
- `src/components/jobs/JobHero.tsx` — button size + explicit white text on primary.

## Out of scope
No backend/hook changes. No new tables, columns, RLS, edge functions, or routes. AI-fit value reuses whatever the card already receives; if absent it renders nothing. Mobile board layout and the Setup / Job Dashboard tab content are untouched.
