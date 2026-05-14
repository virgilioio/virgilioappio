## Scope

Three small fixes on the Jobs list (and its tab variants), plus a row-height clarification.

---

### 1. Empty states use the Gio mascot pattern

Today, when the Jobs table has no rows we render the bare-bones `TableEmpty` / `TableFilteredEmpty` row primitives (a small title + description inside a table cell, no illustration). That matches the strict "no illustrations inside data tables" rule from the Tables Foundation, but it conflicts with the project-wide `GioEmptyState` standard (Gio mascot avatar + semibold title with purple period + description).

Fix: in `JobsTable.tsx`, when `filteredJobs.length === 0`, render a single full-width `<TableRow>` whose cell contains the canonical `<GioEmptyState />`:

- `jobs.length === 0` → `title="No jobs yet"`, `description="Create your first job to start sourcing and tracking candidates."` Optional secondary "New job" button below.
- Otherwise (filtered/no matches) → `title="No matches"`, `description` references the search term and active chips, with a `Clear all filters` ghost button.
- Apply the same in the mobile card list (currently a plain centered text block).

This covers all five tabs (All, Active, Closed, Paused, Archived) since they all flow through the same component.

Note: this is a deliberate, scoped exception to the Tables Foundation "no illustrations" rule for the Jobs table, justified by the global empty-state standard the user is asking us to honor. We will keep the exception local to `JobsTable.tsx` for now and not touch the foundation primitives.

---

### 2. Row height feels tight — switch Jobs table to comfortable density

You're right. Current spec values in `index.css`:

- compact: 40px
- **default: 52px** (what Jobs uses today)
- comfortable: 64px

The mockup row pitch is closer to ~64px (two-line cell: title + meta with breathing room). Switch the Jobs table from `density="default"` to `density="comfortable"`. Header height auto-adjusts to 40px.

No token changes — this preserves the foundation for other tables (Application Review stays on `default` 52px since rows there are single-line).

---

### 3. Tab order

In `src/pages/Jobs.tsx`, reorder the `tabs` array to:

```
All | Active | Closed | Paused | Archived
```

---

## Files touched

- `src/components/jobs/JobsTable.tsx` — replace `TableEmpty` / `TableFilteredEmpty` with `GioEmptyState` rendered inside a single full-span row; bump `density` to `comfortable`; mirror the empty state in the mobile card branch.
- `src/pages/Jobs.tsx` — reorder `tabs` array.

## Out of scope

- Changing the foundation row-height tokens or rolling the comfortable density to other tables.
- Replacing `TableEmpty` globally with `GioEmptyState` (we can do that as a follow-up sweep if you want — say the word).
