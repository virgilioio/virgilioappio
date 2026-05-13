# Add Owner & Company filter chips to Deals

Add multi-select filter chips for **Owner** and **Company (Organization)** to the Deals kanban header, alongside the existing "Amount" chip. Filtering happens client-side over the already-loaded deals list so the kanban updates instantly.

## Scope

- Frontend only. No DB, RLS, or hook changes.
- Reuse existing `FilterChipPopover` (same one used on Pipeline/Jobs).
- Persist nothing; selections live in `Deals.tsx` page state for now (matches current Amount mode behavior).

## UX

Header layout (left → right):
```
[Amount | Total]  [Owner]  [Company]  ........  [+ New Deal]
```

- Both new chips are searchable multi-selects.
- Empty selection = no filter applied.
- Counts shown in chip options reflect the number of deals per owner / per company across the unfiltered list.
- Active filters narrow each kanban column; stage totals + counts recompute automatically since they're derived from the filtered list.

## Implementation

**1. `src/pages/Deals.tsx`**
- Add state: `selectedOwners: string[]`, `selectedOrgs: string[]`.
- Derive option lists from `useDeals()` data:
  - Owners: unique `owner_id` → `{ value: owner_id, label: owner_name ?? owner_email ?? 'Unassigned', count }`.
  - Companies: unique `organization_id` → `{ value: organization_id, label: organization_name ?? 'No company', count }`.
- Pass `selectedOwners`, `selectedOrgs` (and the option lists) into `DealsKanbanBoard`.
- In the `headerLeft` slot, render `<FilterChipSelect Amount /> <FilterChipPopover Owner /> <FilterChipPopover Company />` wrapped so they sit inline.

**2. `src/components/deals/DealsKanbanBoard.tsx`**
- Extend props with `selectedOwners?: string[]`, `selectedOrgs?: string[]`.
- Apply filter before building `dealsByStage`:
  ```
  const filteredDeals = deals.filter(d =>
    (selectedOwners.length === 0 || selectedOwners.includes(d.owner_id ?? '')) &&
    (selectedOrgs.length === 0   || selectedOrgs.includes(d.organization_id ?? ''))
  )
  ```
- Stage totals/counts already derive from `dealsByStage`, so no further changes needed.

**3. Header layout**
- Current header wraps `headerLeft` and pushes `headerRight` with `ml-auto`. Owner/Company chips are part of `headerLeft`, so existing flex-wrap handles overflow on narrow screens. No structural change to `DealsKanbanBoard`'s header markup.

## Out of scope

- Saved views / URL persistence.
- Search-by-title input (can be a follow-up).
- Server-side filtering.
- Any change to `useDeals` query or RLS.
