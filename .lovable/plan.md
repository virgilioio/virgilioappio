# Align CRM Companies table with Jobs table

The CRM > Companies table (`OrganizationsTable.tsx`) currently uses an old `Card` shell, a different filter/search row, custom pagination, and inconsistent badges/buttons. The Jobs table (`JobsTable.tsx`) is the reference implementation for the Gio Foundation table style. This plan ports the Jobs table's structural patterns to Companies while preserving Companies' columns and data.

## What stays the same
- Columns in Companies: **Name**, **Status**, **Actions** (no new data added — UI/structure only).
- Data hook, edit/delete/view handlers, permission gates, details dialog.

## Structural changes (to mirror JobsTable)

1. **Outer chrome** — drop `Card`/`CardHeader`/`CardContent`. Use the same two-card layout JobsTable uses:
   - Top card: `rounded-2xl border border-virgilio-border bg-white overflow-hidden` containing the tabs row + search/filters row.
   - Bottom card: same wrapper around the `<Table>`.

2. **Tabs row** — replace the status `FilterChipPopover` with the Jobs-style segmented tabs (All / Active / Inactive), using the exact classes from JobsTable (`h-9 px-3.5 rounded-lg font-poppins text-[13.5px]`, active pill `bg-[#FAFAF7]`, count in tabular-nums). Counts come from the existing `statusOptions` logic.

3. **Search + filters row** — same `p-3` flex row:
   - Search input: `h-10 pl-10` with `bg-[#FAFAF7] border-transparent rounded-xl text-[13.5px]`, magnifier at `left-3.5`, placeholder "Search companies…".
   - Right side: keep "Create Company" primary button using the standard `<Button>` (no custom classes).

4. **Table** — use `<Table density="comfortable">` (Jobs uses `comfortable`) and the shared `TableHeader/TableRow/TableHead/TableCell` primitives. Rows become `interactive className="group cursor-pointer"`.
   - **Name** column: render via `<IdentityCell hideAvatar name={org.name} fallback={org.name} />` — same font sizing/truncation as Jobs.
   - **Status** column: `<StatusCell><Badge tone={status === 'active' ? 'green' : 'neutral'} dot size="sm">…</Badge></StatusCell>` (replaces the hardcoded `bg-[#d2ffc2]` badge — uses semantic tones).
   - **Actions** column: `<TableHead className="w-[32px] text-right" aria-label="Actions" />` + `<ActionCell>` with a ghost `iconOnly` MoreHorizontal trigger (same as Jobs); items View / Edit / Delete, Delete in destructive style after a separator.

5. **Empty / loading** — match Jobs:
   - Loading: `<TableSkeleton rows={5} columns={3} />` rendered inside a single `<TableRow><TableCell colSpan={3}>` (drop the separate skeleton card).
   - Empty: keep `EmptyState` with `SoftBuilding`, rendered inside the table body row exactly like JobsTable does for "No matching jobs".

6. **Pagination** — remove the entire custom pagination block (the gradient/scale/translate buttons). Replace with `<TableFooterSummary>` (the Gio standard used implicitly by Jobs; Jobs shows row count via the footer). Companies list is small, so a simple footer summary matches the Jobs convention. Pagination state (`currentPage`, `itemsPerPage`) is removed.

7. **Cleanup** — delete unused imports (`ChevronLeft/Right`, `Building2`, `Card*`, pagination helpers, `getPageNumbers`).

## Files touched
- `src/components/organizations/OrganizationsTable.tsx` — full rewrite of the render tree and filter/tab state to match JobsTable patterns.

No backend, hook, or data-shape changes. No new columns. Pure structural/visual alignment.
