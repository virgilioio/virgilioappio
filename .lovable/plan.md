# Add tag — popover, three triggers, rail integration

Implement the `Add tag` flow from `23b_Add_Tag_bulk_row_sheet`. One popover, three entry points, plus a `Tag groups` section in the left rail (yes — the same "land in rail" pattern we used for saved searches).

## Data model

Two new tables, tenant-scoped, with RLS.

- `tags`
  - `id uuid pk`, `tenant_id uuid`, `name text`, `color text` (token like `pastel-purple`/`green`/…), `created_by uuid`, `created_at timestamptz`, `updated_at timestamptz`
  - unique on `(tenant_id, lower(name))`
- `candidate_tags`
  - `candidate_id uuid`, `tag_id uuid`, `tenant_id uuid`, `tagged_by uuid`, `tagged_at timestamptz`
  - pk `(candidate_id, tag_id)`
- RLS: standard tenant-scoped policies (`user_has_tenant_access(tenant_id)`). No CHECK constraints; use SECURITY DEFINER trigger to stamp `tenant_id` from the candidate row on insert into `candidate_tags`.

A migration adds both tables, indexes (`candidate_tags(tag_id)`, `candidate_tags(candidate_id)`), and the trigger.

## Hook layer

`src/hooks/useTags.ts`:

- `useTags()` → `{ tags, isLoading }` — all tenant tags with usage `count` (left join aggregate).
- `useCandidateTagsMap(candidateIds)` → `Record<candidateId, tagId[]>` for the current selection (used to compute applied / partial state).
- Mutations: `applyTags({ candidateIds, addTagIds, removeTagIds })`, `createTag({ name, color })`, `renameTag`, `deleteTag`.
- Mutations are optimistic + invalidate `['tags']` and `['candidate-tags', candidateIds…]`. Toast on success.
- Recent tags tracked client-side in `localStorage('virgilio:tags:recent')` — last 6, most-recent first.

## Popover component

`src/components/candidates/tags/AddTagPopover.tsx` — single component, three triggers reuse it.

Props: `candidateIds: string[]`, `trigger: ReactNode`, `align?`, `onApplied?`.

Layout (320px, shared `menuPanel` chrome):

1. **Header** — `Tag N candidates` (or single name) + truncated name list (`Lena Park, Priya Iyer, Eli Tran`).
2. **Search input** — 32h, "Find or create a tag…". Typing filters; if no exact match, last row becomes `Create "{query}" as a new tag` (icon-leading, separator above).
3. **Recently used** — group label, up to 6 chips with checkbox.
4. **All tags · N** — scrollable list (max ~280px), each item:
   - Checkbox state: `unchecked` · `checked` (all selected candidates have it) · `indeterminate` (partial — some do).
   - Tag dot + name + small usage count right-aligned.
   - Click toggles: partial → fully-applied (adds to candidates missing it); checked → removed; unchecked → added.
5. **Footer** — `Changes apply instantly · ⌘Z to undo`.

Behaviour:
- Apply is **instant** on each toggle (no Apply button) — matches reference.
- After each mutation, push an entry to a local undo stack; `⌘Z` (while popover open) restores prior state via inverse `applyTags` call.
- Closing popover dismisses undo stack and shows the consolidated toast:
  `"2 tags applied to 3 candidates"` with `Undo` action (5s), wired to a single `applyTags` revert.
- Empty state (no tags exist yet): centred icon + "No tags yet. Start typing to create one."

## Three triggers

All three render `<AddTagPopover candidateIds={…} trigger={…}/>`.

1. **Bulk bar** — `BulkActionBar`'s existing `Tag` button becomes the trigger. Replace the current `onTag` toast with the popover. `candidateIds = selectedIds`.
2. **Row 3-dot menu** — `CandidatesTable` row menu gains `Tag…` item above `Delete` (separator stays). Clicking it opens the popover anchored to the row, scoped to that single candidate. Use the menu-item-with-popover pattern (`DropdownMenuItem` calls `setOpenTagForId(c.id)`; popover lives at table level, anchored via a virtual ref).
3. **Profile sheet — Tags slot** — `ProfileHeroCard` gets a new `Tags` row below the headline showing applied tag chips (dot + label, `RemovableChip` from badge-tones map for the color). A `+ Add tag` dashed chip opens the popover scoped to that candidate. Removing a chip calls `applyTags({ removeTagIds: [tag.id] })`.

## Rail integration — Tag groups

Add a third section to `CandidatesSearchesRail`, below `Smart lists`:

```text
TAG GROUPS                                +
  • Design systems        128
  • Figma                  86
  • B2B SaaS               54
  ... (top 8 by usage)
  Show all tags →
```

- Each row is a `SmartListItem`-style entry; clicking it filters the candidates list to candidates with that tag (active state = lilac left rail like saved searches).
- New filter chip in `CandidateFilterContext`: `tagIds: string[]`. `useCandidateFilteredData` filters by `candidate_tags.tag_id IN (…)`.
- Row hover reveals the same ellipsis pattern we built for saved searches with: `Rename`, `Change color`, `Delete`. Delete opens the same Jobs-style `AlertDialog` ("Delete tag permanently?" — describes that the tag is removed from N candidates).
- The trailing `+` opens a tiny "Create tag" popover (name + 8-swatch color picker), same input chrome as the inline create.
- `Show all tags →` opens a sheet listing every tag with usage, search, and the same row menu.

## Files

**New**
- `src/components/candidates/tags/AddTagPopover.tsx`
- `src/components/candidates/tags/TagChip.tsx` (dot + label, color from `badge-tones`)
- `src/components/candidates/tags/CreateTagPopover.tsx` (used by rail `+`)
- `src/hooks/useTags.ts`
- `src/hooks/useCandidateTagsMap.ts`
- Supabase migration: `tags`, `candidate_tags`, RLS, trigger, indexes.

**Edit**
- `src/components/candidates/list/BulkActionBar.tsx` — wrap Tag button in popover.
- `src/components/candidates/list/CandidatesTable.tsx` — add `Tag…` menu item + popover anchor.
- `src/components/candidates/list/CandidatesSearchesRail.tsx` — new `Tag groups` section, props for tag list + handlers.
- `src/components/candidates/profile/ProfileHeroCard.tsx` — Tags slot with chips + Add affordance.
- `src/contexts/CandidateFilterContext.tsx` — add `tagIds` array filter.
- `src/hooks/useCandidateFilteredData.ts` — apply `tagIds` filter.
- `src/pages/Candidates.tsx` — wire popovers, rail tags list, delete dialog, refresh after mutation.

## Visual contract

- Popover: shared `menuPanel` chrome, 320 w, 4 px pad, 12 px radius, 30 h items, 12.5 px Inter labels, `#F1F0EC` hover, `#EDE4FF` selected.
- Tag colors: reuse `badge-tones` map (`pastel-purple`, `green`, `pink`, …). New tags default to next unused color in rotation.
- Chips on profile: `RemovableChip` from existing badge primitive, size `sm`.
- Toasts: noir, mirror the saved-search toast.
- Honours `prefers-reduced-motion` (no scale on chip insertion — just opacity).

## Out of scope

- Tag categories / nested groups.
- Sharing tags across tenants.
- Bulk rename / merge tags.
- Inline color editing inside the Add Tag popover (color is set at create-time only; rename/recolor happens from the rail menu).
