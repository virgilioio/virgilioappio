# Tag groups in the left rail

Yes — fully possible. The `tags` / `candidate_tags` tables, the `useTags` hook, and the `tagIds` filter on `CandidateFilterContext` are already shipped. We just need to surface them in `CandidatesSearchesRail`.

## What you'll see

A third section appears in the left rail, below **Smart lists**:

```text
Searches                + New
─────────────────────────────
MY SEARCHES
  • Frontend EU                 ⋯
  • Senior PMs                  ⋯

SMART LISTS
  All candidates           1,204
  In active pipeline         312
  ...

TAGS                           +
  • Top talent              42
  • Referral                17
  • Phone screen done       9
  ...
```

Naming: **Tags** (short, matches the popover label). Falls back to "No tags yet — create one from a candidate" when empty.

## Behavior

- Each tag row shows the tag's colored dot, name, and usage count (right-aligned, tabular).
- Click a tag → sets `filters.tagIds = [tagId]` and clears `activeViewId` / `activeSmartList`. The row gets the same lilac left-rail selected state as smart lists.
- Active tag highlights with the standard `ITEM_SELECTED` treatment.
- Row hover reveals a `⋯` ellipsis with **Rename**, **Change color**, **Delete** — same menu pattern as saved searches. Delete opens the existing destructive `AlertDialog` (same one used for saved-search / job delete) and calls `deleteTag` (cascades `candidate_tags`).
- Section header has a trailing `+` that opens `CreateTagPopover` anchored to it.
- Sorted by usage_count desc, then name. Show top 12; if more, a `Show all (N)` toggle expands the list.

## Technical notes

- New props on `CandidatesSearchesRail`: `tags`, `activeTagId`, `onSelectTag`, `onCreateTag`, `onRenameTag`, `onDeleteTag`.
- `Candidates.tsx` wires them: `tags` from `useTags()`, `activeTagId = filters.tagIds[0] ?? null`, handlers using `useTagMutations()`.
- `onSelectTag(id)` calls `setFilters(f => ({ ...f, tagIds: [id] }))` plus the existing "clear other view selectors" logic already used by `onSelectSmartList`.
- Selecting a saved search or smart list clears `tagIds` (mirror the existing reset done when switching between views).
- Reuse the saved-search delete dialog component for tag delete confirmation — pass tag name + usage count into the body copy ("This will remove the tag from N candidates").
- No DB changes. No edge-function changes. Pure frontend.

## Out of scope

- Drag-to-reorder tags
- Nested tag groups / categories
- Inline rename (uses a small popover, same as create)
