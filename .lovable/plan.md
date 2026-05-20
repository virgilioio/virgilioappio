# Saved-search row actions (My searches rail)

Add a row-actions ellipsis to each saved search in the **My searches** group of `CandidatesSearchesRail`, mirroring the pattern already used on candidate rows in `CandidatesTable` (ghost `MoreHorizontal`, opacity 0 → 1 on row hover, opens a `DropdownMenu` aligned `end`).

## Menu contents

Three items, in this order, all routed to flows that already exist:

1. **Edit** — selects the view (same as clicking the row), which loads its filters and puts the toolbar into the existing **Editing search** state (lilac pill + `N changes` + `Save changes` / `Save as new` / `Revert`). No new screen.
2. **Duplicate** — calls `useSavedViews.createView` with the source view's `filters`, `sort_state`, `extra_state`, and `name + " (copy)"`. Selects the new view and shows the standard "Search saved" toast with Undo, reusing the `justSavedId` highlight already wired in the rail.
3. **Delete** (separated by `DropdownMenuSeparator`, `text-destructive`) — opens a confirmation `AlertDialog` styled like the Jobs **Delete job permanently?** dialog (title, description naming the search, `Cancel` + danger `Delete search`). On confirm, calls `useSavedViews.deleteView`; if the deleted view was active, fall back to the `All candidates` smart list.

## Visual contract

- Trigger: `Button variant="ghost" iconOnly icon={MoreHorizontal} size="xs"` placed in the rail item, `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`. Existing rail item already uses `group`.
- Menu: shared `menuPanel` chrome, `align="end"`, `sideOffset={6}`, 30h items, danger LAST after divider — matches dropdown spec in `docs/style-guide.md` §5.
- Dialog: reuse `AlertDialog` primitives, `max-w-md`, copy: *"This will permanently delete the saved search "{name}". This action cannot be undone."*. Confirm button uses `buttonVariants({ variant: "danger" })` or equivalent destructive treatment already used for Delete job.

## Files

- **Edit** `src/components/candidates/list/CandidatesSearchesRail.tsx`
  - Add `onEdit`, `onDuplicate`, `onDelete` props on `SavedSearchItem` / rail.
  - Add ellipsis trigger + `DropdownMenu` (stop propagation so the button doesn't toggle row selection).
- **Edit** `src/pages/Candidates.tsx`
  - Wire `onDuplicate` → `createView.mutateAsync` then select + toast (reuse existing `justSavedId` setter and "Search saved" toast).
  - Wire `onDelete` → open new local `deleteSavedViewId` state; render `AlertDialog`; on confirm call `deleteView.mutateAsync` and clear `activeViewId` if it matched.
  - `onEdit` reuses the existing `handleSelectView` (no new code path).

## Out of scope

- Renaming inline in the rail (Edit means "open in editing state", same as today's click).
- Bulk delete, shared/team search permissions, alert toggles.
