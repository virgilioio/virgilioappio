# Align Candidates page with Jobs page visuals

Five surgical, presentation-only fixes. Jobs page is the reference; nothing in Jobs changes.

## 1. Header — counters & top-right buttons

**File:** `src/components/candidates/list/CandidatesHeader.tsx`

- Replace the pill-style `KpiChip` row with the Jobs-style "dot + count + label" markers (small colored dot, tabular number, muted label). Keep them clickable — clicking still toggles the smart list — but drop the chip background, height, and purple active fill. Active state = bolder text, no background, to stay calm like Jobs.
  - `in active pipeline` → green dot (`bg-pastel-green-foreground`)
  - `awaiting outreach` → neutral dot (`bg-text-tertiary`)
  - `favorites` → pink dot (`bg-pastel-pink-foreground`)
  - `new this week` → purple dot (`bg-virgilio-purple`)
- Match Jobs typography: `text-body-sm text-text-secondary`, `gap-x-4 gap-y-1`.
- **Remove the kebab `<DropdownMenu>` trigger entirely** (issue #3 — dead button). Keep the existing `Import CSV`, `Bulk upload`, `+ Add candidate` buttons in the top-right, in that order, matching Jobs spacing (`gap-2 shrink-0`).
- On mobile (where `Import CSV` / `Bulk upload` were `hidden lg:inline-flex`), keep them visible at all widths like Jobs does, or drop only the labels — simplest: keep as-is on lg+, accept that small screens won't show them (matches current behavior, no regression).

## 2. Search bar color

**File:** `src/components/candidates/list/CandidateSearchBar.tsx`

- Outer wrapper currently: `bg-white border border-virgilio-border focus-within:border-virgilio-purple focus-within:ring-2 focus-within:ring-virgilio-purple/30` and `h-11 rounded-xl`.
- Change to match Jobs search input: `h-10 rounded-xl bg-[#FAFAF7] border border-transparent focus-within:bg-white focus-within:border-virgilio-border`. Drop the purple ring/border treatment, including the AI-mode purple variant on the outer container (keep the purple Sparkles icon and the purple "Ask" button — those are intent signals, not chrome).
- Adjust input height to match (`h-10`).

## 3. Remove the dead ellipsis button

Handled in #1 (removal of the `DropdownMenu` block in `CandidatesHeader.tsx`).

## 4. Search-mode tabs styled like Jobs status tabs

**File:** `src/components/candidates/list/SearchModeTabs.tsx`

Adopt the Jobs filter-tabs aesthetic (from `JobsTable.tsx` lines 183–210):

- Drop the `p-1 rounded-lg bg-[#F5F4EF]` segmented background. Render as a flat tab strip: `inline-flex items-center gap-1`.
- Each tab: `inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg font-poppins text-[13.5px] tracking-[-0.01em] transition-colors`.
- Active: `bg-[#FAFAF7] text-text-primary font-semibold`.
- Inactive: `text-text-tertiary hover:text-text-primary font-medium`.
- **Keep the icons** (Search / Code2 / Sparkles) at `h-3.5 w-3.5` to the left of the label. For the AI tab, when active, keep the icon `text-virgilio-purple` to preserve the AI cue.

## 5. Candidates list pagination = Jobs pagination

**File:** `src/pages/Candidates.tsx` (around line 601) and the CandidatesTable card footer.

- Replace `<CandidatesFooter ... />` with `<TableFooterSummary>` from `src/components/ui/table-pagination.tsx`, mirroring Jobs (`JobsTable.tsx` lines 419–426):
  ```tsx
  <TableFooterSummary
    rangeStart={1}
    rangeEnd={visible.length}
    total={finalAfterSmart.length}
    entityLabel="candidates"
    onLoadMore={() => setPage(p => p + 1)}
    loadMoreLabel={`Load ${pageSize} more`}
  />
  ```
  Render only when `visible.length > 0 && !isLoading`, matching Jobs' guard.
- Leave `CandidatesFooter.tsx` in place for now (unused) — safe to delete later; out of scope to avoid breaking other imports.
- The page-size selector currently inside `CandidatesFooter` is dropped (Jobs has no per-page selector). If the user wants it back later we can revisit; spec says "use the exact same one."

## Out of scope

- Sidebar/rail, filter card outer chrome, table internals, dialogs, bulk-action bar, business logic, data fetching.
- Jobs page (untouched, it is the reference).
