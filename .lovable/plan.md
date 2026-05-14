## Tighten typography, filter chips, and apply Tables Foundation v1

Scope confirmed: this pass touches only the **Jobs list table** and the **Application Review table** inside a job. A broader app-wide table sweep can follow separately.

### 1. JOB column typography — match the foundation
The current row uses Poppins 14/600 with a custom layout. The Tables Foundation §4 says the first column is `<IdentityCell name sub />` rendering `text-table-name` (13/500 Inter) for the title and `text-table-sub` (11/400 muted) for the meta line.

Action in `JobsTable.tsx`:
- Replace the inline `<span className="font-poppins font-semibold text-[14px]">{title}</span>` block with `<IdentityCell />` — but render it **without an avatar** (per the user's earlier request) by extending `IdentityCell` with an optional `hideAvatar` prop, OR by using `IdentityCell` with `src=undefined` and `fallback=""` and a new `noAvatar` variant.
- Cleanest path: add `hideAvatar?: boolean` to `IdentityCell` (one prop, default false) and use it from JobsTable. This keeps every other table on the canonical primitive and also lets the Application Review table use it where avatars are desired.
- Title content stays as a ReactNode so the inline `Trending` badge (`<Badge tone="purple" size="xs">`) keeps working.
- Sub line: `Full-time · {n} candidates`.

### 2. Filter chips — match the mockup
Mock shows: rounded `~10px` rectangle (not pill), white background, hairline `border-virgilio-border`, `~36px` height, `+` glyph then label in dark text — all four chips identical in look.

Action in `src/components/ui/filter-chip-popover.tsx` (used in many places, change must be backwards compatible):
- Add a `variant?: 'pill' | 'soft'` prop (default `pill` = current rounded-full look so existing call sites are unchanged).
- New `soft` variant trigger styles:
  - `h-9 px-3.5 rounded-lg border border-virgilio-border bg-white text-text-primary text-[13px] font-poppins font-medium hover:bg-[#FAFAF7] active:bg-[#F1F0EC]`
  - Active state (selection present): same border + `bg-[#FAFAF7]` + selected value summary appended after the label.
  - Inline `+` glyph (text, not icon) with `mr-1.5` for visual parity with the mockup.
- Apply `variant="soft"` to all four chips on the Jobs page.

### 3. Apply Tables Foundation v1 to the JOBS table
Already largely applied. Remaining cleanup in `JobsTable.tsx`:
- **Header**: keep `<TableHead>` defaults so they pick up `text-table-header` (10.5 caps Inter +0.06em) — no change needed.
- **Row text**: switch all `text-text-secondary` cells (`Company`, `Location`) to the spec's body cell token (`text-table-cell`, 13/400 Inter). This already happens automatically via `<TableCell>`, so just drop the explicit overrides.
- **Identity cell**: see §1 above.
- **Stage** column: keep `<StatusCell>` with one `<Badge dot size="sm">` (compliant).
- **Pipeline** column: presentational — keep current PipelineBar (compliant).
- **Days open**: wrap in `<NumericCell>` and set the cell to `text-right` (already done — verify the destructive variant honors tabular-nums).
- **Owner**: `<ComposedCell><AvatarStack people max={1} size={28} /> <span className="text-table-cell">…</span></ComposedCell>`. Bump avatar from 22px → 28px to match the default density spec, and use `max={1}`.
- **Actions**: column width 32px (not 44px) per spec; keep `<ActionCell>` with `iconOnly` ghost (already wrapping the `MoreHorizontal` button).
- **Footer**: keep `<TableFooterSummary>` (compliant).
- **Wrapping card**: keep the rounded-2xl `bg-white` wrapper — fine; foundation expects `radius 12 (wrapper)`, our 16 reads slightly softer and is consistent across the page.

### 4. Apply Tables Foundation v1 to the Application Review table
The Application Review tab inside `JobDetail.tsx` renders `<CandidateTable />` (700 LOC, currently uses raw `<TableRow>`/`<TableCell>` with custom `font-medium` typography, no `IdentityCell`/`StatusCell`/`NumericCell`, custom skeleton/empty, custom pagination). Aligning it without rewriting the whole file:

Targeted changes inside `src/components/candidates/CandidateTable.tsx` (rendering layer only — no data/filter logic touched):
- Wrap `<Table>` with `density="default"`.
- **Header row**: drop any custom classes on `<TableHead>` so they render the `text-table-header` style.
- **Identity column** (candidate name + headline): replace the inline `font-medium text-text-primary` block with `<IdentityCell name={…} sub={…} src={avatarUrl} fallback={initials} />`. Keep the small `New` chip as a `<Badge tone="purple" size="xs">` adjacent to the name (passed inside the `name` ReactNode).
- **Status / stage**: replace inline pills with `<StatusCell><Badge dot size="sm" tone={…}>…</Badge></StatusCell>`.
- **Fit score**: replace inline numeric span with `<NumericCell>`. Wrap the cell with `className="text-right"`.
- **Skills**: keep current chip stack but cap visible to 3 with `<OverflowMore count>` for the rest (already in `@/components/ui/badge` family).
- **Source / location / applied-at**: cells use plain text — drop ad-hoc font sizes so they pick up `text-table-cell`.
- **Loading**: replace existing `<Skeleton>` rows with `<TableSkeleton rows={5} columns={N} />` from `@/components/ui/table-states`.
- **Empty / filtered empty**: replace `GioEmptyState` inside the data table with `<TableEmpty colSpan={N} title description ctaLabel onCta />` (foundation explicitly forbids illustrations inside data tables; the Gio mascot stays for app-level empties only).
- **Footer**: replace the custom prev/next pager with `<TableFooterSummary rangeStart rangeEnd total entityLabel />` plus a "Load more" call into the existing pagination handler — drop the page-jumper UI here.
- **Actions column**: wrap the row's overflow menu in `<ActionCell>` (32px) so it appears on row hover only.
- **Bulk-select bar**: when `selectionMode && selectedIds.length > 0`, swap the toolbar for `<TableBulkBar>` (per foundation). Map existing bulk actions (Move stage, Reject = `variant="danger"`, etc.) to bar buttons.

Where the existing component renders a fully different mobile card view, leave it alone — the foundation governs the desktop table only and mobile is consultation-first.

### 5. Files touched
- `src/components/ui/table-cells.tsx` — add `hideAvatar?: boolean` to `IdentityCell`.
- `src/components/ui/filter-chip-popover.tsx` — add `variant?: 'pill' | 'soft'` (default `pill`).
- `src/components/jobs/JobsTable.tsx` — switch JOB column to `<IdentityCell hideAvatar />`, set chips to `variant="soft"`, owner to `<ComposedCell>` with 28px avatar, drop redundant text-color overrides on cells, narrow actions column to 32px.
- `src/components/candidates/CandidateTable.tsx` — apply foundation primitives to rendering layer (cells/skeleton/empty/pagination/bulk bar) without touching data, filters, or business logic.

### Out of scope for this pass
- Other 26 tables across the app (Members, Sourcing, Organizations, Invoices, Audit, Settings managers, etc.) — separate pass per your direction.
- Any data/query/permission/business-logic changes.
