
# Tables Alignment Plan — Gio Foundation v1.0

This is a complete gap audit between the uploaded `00_Tables.html` spec and the current `src/components/ui/table.tsx` + table call sites. Nothing in the spec is omitted below; every section is either marked **Compliant**, **Partial**, or **Missing** with the exact fix.

---

## 1. Foundation tokens (`src/index.css`) — **Missing**

Spec mandates these CSS variables. We currently only have a single `--table-row-height: 40px`.

Add to `:root`:
```
--tbl-row-h-compact: 40px;
--tbl-row-h-default: 52px;   /* ★ standard */
--tbl-row-h-comfy:   64px;
--tbl-header-h-compact: 32px;
--tbl-header-h-default: 36px;
--tbl-header-h-comfy:   40px;
--tbl-cell-px:  14px;
--tbl-cell-gap: 12px;
--tbl-divider:  1px solid hsl(var(--virgilio-border));
--tbl-row-hover:    hsl(40 33% 98%);   /* #FAFAF7 */
--tbl-row-selected: hsl(267 100% 98%); /* #FAF8FF */
--tbl-row-rail:     2px solid hsl(var(--virgilio-purple));
--tbl-zebra:        hsl(40 33% 98%);
--tbl-border-radius: 12px;
--tbl-border:       1px solid hsl(var(--virgilio-border-strong)); /* #E7E8EE */
```

Add typography tokens for table cells (extend the type scale we already standardized):
- `text-table-header` → 10.5px Inter UPPERCASE, weight 500, tracking +0.06em, color `text-text-tertiary`.
- `text-table-cell` → 13px Inter, weight 400 (names 500).
- `text-table-sub` → 11px Inter, weight 400, color `text-text-tertiary` (sub-text under name).
- `text-table-num` → 13px Poppins, weight 500, `tabular-nums`, right-aligned.
- `text-table-mono` → 12.5px JetBrains Mono, weight 500.
- Compact variant: cell text drops to 12px, header to 10px.

---

## 2. Core component (`src/components/ui/table.tsx`) — **Partial / Wrong defaults**

Current state vs spec:

| Concern | Current | Spec | Fix |
|---|---|---|---|
| Default row height | `h-11` (44px) | 52px | Use `h-[var(--tbl-row-h-default)]` |
| Header row height | `h-11` (44px) | 36px | Use `h-[var(--tbl-header-h-default)]` |
| Header typography | `text-xs font-medium text-text-secondary` | 10.5px Inter UPPERCASE, +0.06em, muted | Apply `text-table-header uppercase` |
| Cell padding | `px-2 py-2` | `0 14px` x · 12px gap | `px-[var(--tbl-cell-px)]` |
| Hover | `hover:bg-muted/50 hover:-translate-y-px` | `#FAFAF7`, **flat — no translate, no glow** | Remove `-translate-y-px`; use `--tbl-row-hover`. This violates the explicit "Hover & selection — fill, not glow" Don't. |
| Selected | `bg-muted` only | `#FAF8FF` + 2px purple **left rail** | Add `data-[state=selected]:border-l-2 data-[state=selected]:border-l-virgilio-purple` and `--tbl-row-selected`. |
| Header background | translucent backdrop-blur | `#FAFAF7` solid | Use `bg-[var(--tbl-row-hover)]`. |
| Divider | `border-b border-border/60` | `1px #F1F0EC` between rows | Map to `--tbl-divider`. |
| Outer border + radius | none | `1px #E7E8EE`, radius 12 on wrapper | Add to wrapper `<div>`. |

### New API

Add a `density` prop (`"compact" | "default" | "comfortable"`) on `<Table>`, propagated via context to `<TableHeader>`, `<TableRow>`, `<TableHead>`, `<TableCell>`. Defaults to `default`. Avatars switch sizes accordingly (22 / 28-32 / 32+).

Add a `zebra` prop on `<Table>` (off by default; when on, applies `--tbl-zebra` to `tr:nth-child(even)`).

---

## 3. Column type primitives — **Missing (compose helpers)**

Spec defines six and only six cell shapes. We have none as named primitives — every table builds them ad hoc. Create `src/components/ui/table-cells.tsx` exporting:

1. **`<IdentityCell>`** — `avatar (32) + name (13/500) + sub (11/muted)`. Two-line layout, left-aligned.
2. **`<StatusCell>`** — wraps a single `<Badge size="sm">`. Enforces "one badge per cell — never stack" by accepting a single child.
3. **`<NumericCell>`** — `text-table-num`, right-aligned, tabular-nums, weight 500.
4. **`<MonoCell>`** — `text-table-mono` for invoice IDs, API keys, slugs.
5. **`<ComposedCell>`** — stacked avatars (−8px overlap, max 4 + `+N` overflow) and badge clusters using existing `<OverflowMore>` chip.
6. **`<ActionCell>`** — fixed 32px column, `iconOnly` ghost buttons OR a single `⋯` menu, opacity 0 → 1 on row hover (`group-hover:opacity-100`).

Update `<TableRow>` to add `group` so `ActionCell` hover reveal works.

---

## 4. Row states — **Partial**

Spec calls out five states explicitly. Status today:

- **Default** — OK once row height fixed.
- **Hover** — Wrong (translate + wrong color). Fix in §2.
- **Selected** — Missing left rail + wrong fill. Fix in §2.
- **Empty** — Missing standard. Add `<TableEmpty title description ctaLabel onCta />`. Center text + single CTA. Spec: "Don't use illustrations inside data tables — keep them for app-level empties." Document this as a deviation from our existing global "Gio mascot empty state" rule for table-internal empties.
- **Filtered empty** — Missing. Add `<TableFilteredEmpty query activeFilters onClearFilters />` rendering "No matches" + clear-filters action.
- **Loading** — Missing dedicated component. Add `<TableSkeleton rows={5} columns={N} />`. Header stays solid; render 3–5 skeleton rows minimum. Replace ad-hoc skeleton implementations across the call sites in §6.
- **Expanded / Error / Disabled** — Spec mentions but does not detail; add `data-state="expanded|error|disabled"` styling hooks (subtle border-left tint for error, 40% opacity for disabled).

---

## 5. Toolbar (`<TableToolbar>`) — **Missing as a primitive**

Spec mandates a canonical toolbar above every table. Create `src/components/ui/table-toolbar.tsx`:

```
┌─ Search (30h, max 280w, explicit placeholder) ─┬─ Segmented status (counts inline) ─┬─ Filter pills (purple removable) + "+ Filter" ghost ──────  Right cluster: Columns · Density · Export · Primary action ┐
```

Sub-components:
- `<TableSearch placeholder="Search members…" />` — height 30px, max-w 280px.
- `<TableSegmented options counts value onChange />` — active = white card, mirrors most-filtered column.
- `<TableFilterPills filters onRemove />` + `<TableAddFilterButton />` — purple removable badges (already have `<RemovableChip>`), ghost trigger.
- `<TableRightActions />` slot — order enforced: Columns toggle → Density → Export → Primary. Primary is the only non-ghost button.

### Bulk-select morph
When `selectedCount > 0`, the toolbar swaps to `<TableBulkBar count onClear>{actions}</TableBulkBar>`:
- "N items selected · Clear selection" left
- Bulk actions right (Move stage, Email, Archive, Reject) — Reject is `variant="danger"` per buttons spec.

---

## 6. Footer / pagination — **Missing**

Two patterns, mutually exclusive (spec: "Never both"). Add:

- **`<TableFooterSummary range total entityLabel onLoadMore />`** — default. "Showing 1–25 of 147 candidates" + Load more.
- **`<TablePagination page totalPages perPage perPageOptions onChange />`** — for invoice/audit tables only. Document: do NOT use for candidate/people tables (filtering is the right primitive there).

---

## 7. Density usage rules (documentation + lint guidance)

Encode the "when to use which" in `docs/style-guide.md` §4 (Tables) and as JSDoc on the `density` prop:
- `compact (40)` — only Pipeline overview, audit logs, integration sub-rows, or any screen with >50 rows.
- `default (52)` — everything else (Members, Candidates, Jobs, Invoices, SaaS customers).
- `comfortable (64)` — marketing-style listings inside embeds (e.g., careers page job list). Almost never inside the app.

---

## 8. Style-guide doc — **Missing §4 Tables**

Add a complete §4 to `docs/style-guide.md` mirroring §2/§3 structure:
- Anatomy diagram (header, body row, padding, dividers, border, hover, selected, zebra).
- Density table (compact / default / comfy with header heights, cell text size, avatar size).
- Six column types with usage rules.
- Row states reference.
- Toolbar anatomy + bulk-select morph.
- Footer vs pagination decision rule.
- Do/Don't pairs verbatim from the spec:
  1. Headers — eyebrow caps, never bold body weight.
  2. Density — match the use, don't pick at random.
  3. Alignment — numeric right, text left.
  4. Hover & selection — fill, not glow.

Update `mem://index.md` Core: replace the existing "Standard 4-row table headers" line with a richer Tables one-liner referencing the new spec, and add a `[Tables foundation](mem://style/tables/foundation-v1)` memory entry.

---

## 9. Call-site sweep (Phase E — separate pass after primitives land)

After §1–§8 land, audit and migrate these tables to the new primitives (`density`, `IdentityCell`, `NumericCell`, `MonoCell`, `ActionCell`, `<TableToolbar>`, `<TableSkeleton>`, `<TableFooterSummary>` / `<TablePagination>`):

- `MembersTable.tsx` (default density, IdentityCell, segmented status, bulk bar).
- `CandidateTable.tsx` + `IndependentCandidateTable.tsx` (default density, IdentityCell + StatusCell + ActionCell, bulk bar with `danger` Reject).
- `JobsTable.tsx`, `JobPostingsTab.tsx` (default density, NumericCell for counts/salary, ComposedCell for hiring team).
- `InvoiceHistoryTable.tsx` (default density, MonoCell for invoice IDs, NumericCell for amount, numbered pagination).
- `OrganizationsTable.tsx`, `SaaSCustomersList.tsx` (default density).
- `AdminAuditLog.tsx` → **compact** density (audit log).
- `PipelineOverview.tsx`, `PipelineOverviewTable.tsx` → **compact** density.
- `JobStagesTable.tsx`, `*Manager.tsx` settings tables → default density, drop ad-hoc skeletons.
- Sourcing tables (`SourcingCandidateTable.tsx`, `Saved`, `Archived`) → default, IdentityCell + ActionCell.
- Analytics section tables (`StagePerformanceSection`, `SourcePerformanceSection`, `RecruiterPerformanceSection`, `JobHealthSection`) → compact (dense scanning).

For each: remove manual `h-*`, `px-*`, `text-xs uppercase` overrides, manual skeletons, and ad-hoc toolbars; replace with primitives.

---

## 10. Implementation order

1. Add CSS variables + typography tokens (§1).
2. Refactor `table.tsx` (§2) with `density` context, fix hover/selected/header.
3. Add `table-cells.tsx` primitives (§3).
4. Add `<TableSkeleton>`, `<TableEmpty>`, `<TableFilteredEmpty>` (§4).
5. Add `<TableToolbar>`, `<TableSearch>`, `<TableSegmented>`, `<TableFilterPills>`, `<TableBulkBar>` (§5).
6. Add `<TableFooterSummary>` and `<TablePagination>` (§6).
7. Update `docs/style-guide.md` §4 + `mem://index.md` (§7–§8).
8. **Stop and request approval** before the call-site sweep (§9), since that touches ~25 files.

### Technical notes
- `TableRow` must add `group` className so `ActionCell` opacity transitions work without each call site re-adding it.
- `density` should be propagated via a small `TableDensityContext` rather than prop-drilling to every cell.
- All colors stay HSL via existing tokens (`--virgilio-border`, `--virgilio-border-strong`, `--virgilio-purple`); do not hard-code hex anywhere except as comments in `index.css`.
- Header `bg` must be solid `#FAFAF7`, not the current translucent backdrop-blur (spec is explicit).
- The "no translate, no glow" hover rule directly overrides the current `hover:-translate-y-px` — this is the single biggest visual drift and the most-cited Don't in the spec.
