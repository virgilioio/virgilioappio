# Inline "Create new tag" panel inside Add Tag popover

Today the Add Tag popover already has a one-click "Create '<query>' as new tag" row that auto-cycles colors. We'll upgrade that into the proper 3-step inline create flow from the reference, so users can pick a color (and later a scope) before committing.

## The 3 steps (all inside the existing Add Tag popover — no new screen)

1. **No-matches → prominent Create row**
   The existing "Create …" row gets promoted to a pinned footer-style CTA with a `+` chip on a darker fill (matches reference). Above it, a small empty illustration + `No existing tag matches` helper text when the typed query has zero matches. (When there are some partial matches, the create row stays at the bottom of the list, no helper text.)

2. **Inline create panel** (replaces the list area of the popover, no new dialog)
   Triggered by clicking the Create row or pressing Enter on a non-matching query.
   - Header: `<TagIcon /> Create new tag` · subline `Will apply to N selected candidate(s)`.
   - **Tag name** — text input, prefilled with the typed query.
   - **Color** — 8-swatch row using `TAG_COLOR_PRESETS`, large 28px circles, selected swatch gets a ring (same pattern as `CreateTagPopover`).
   - **Live preview** — a `<TagChip>` rendered below using the current name+color so users see the final pill in real time.
   - Buttons: `Back` (returns to the list, keeps query) and primary `Create` (default Button, no override — per Forms standard). Enter in name field also submits.

3. **Pinned at top of library + applied**
   On success:
   - Tag is created, immediately applied to the selected candidates, added to recents.
   - Popover returns to the list view; the new tag is rendered in a temporary `Just created` group at the very top (checked), above `Recently used` / `All tags`. That group disappears the next time the popover opens.
   - Existing close-time consolidated toast already covers the "X tags updated · N candidates · Undo" feedback shown in the reference.

## Out of scope (call out, don't build)

- **Workspace vs Private scope.** The `tags` table has no visibility column today and all tags are tenant-wide via RLS. Showing this control would be a lie. We'll leave it out for v1; if you want private tags, that's a separate small migration (`tags.visibility` enum + a `created_by` check in RLS) and we'll add the segmented toggle then.
- Tag categories / grouping.
- Editing color/name from this panel (already covered by the rail row "Rename / change color" popover).

## Technical notes

- Single component change: `src/components/candidates/tags/AddTagPopover.tsx`.
- New internal state: `mode: 'list' | 'create'`, `draftName: string`, `draftColorIdx: number`, `justCreatedId: string | null`.
- New tiny subcomponent `CreatePanel` rendered when `mode === 'create'`; the rest of the popover chrome (header, search input, footer) stays mounted. The list/`create` row area swaps.
- Reuse `TagChip` for the live preview. Reuse `tagColorClasses` for swatches.
- Submit path reuses the existing `createTag.mutateAsync` + `applyTags.mutateAsync` + `pushRecentTagId` sequence already in `handleCreate`; just sourced from the panel state.
- Pinned-at-top behavior: render a `Just created` group when `justCreatedId && tags.find(t => t.id === justCreatedId)` exists; clear `justCreatedId` on popover close.
- No DB migrations. No changes to `useTags`, the rail, or `CreateTagPopover` (used by the rail; unchanged).
