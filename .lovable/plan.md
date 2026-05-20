# Save current search — popover flow

Build a single coherent "Save as search" UX on the Candidates page that mirrors the 4-step reference: filters applied → name + scope popover → lands in the left rail with toast → editing state with unsaved-changes pill. Keep everything on the frontend; reuse the existing `useSavedViews` hook (no schema changes).

## What the user gets

1. **Trigger (top-right of search bar).** A `Save as` chip-button that lives in the search-bar row. It is dormant when no filters are applied, and gently pulses (one-time, calm) the first time the user has unsaved filters in a session, hinting that the query is worth crystallizing.
2. **Save popover.** Click `Save as` → a 320 px popover anchored to the button. Contents:
   - Title "Save as search" + one-line helper "Pin this query to the left rail."
   - **Search name** input, pre-filled with a smart auto-name derived from the active filters (e.g. *Design systems leads · NYC*), with an `Auto-name` chip on the right that re-derives if the user has edited.
   - **Save to** segmented control: `My searches` (default) / `Shared with team` (disabled stub with tooltip "Coming soon" — keeps the surface honest).
   - **Alert me on new matches** toggle, with sub-line "Email weekly · in-app on every match" (stub — wire the toggle to a column on `saved_views.extra_state`, no notifier yet).
   - **Pin to top of My searches** checkbox.
   - Footer: `⌘ Enter to save` hint left, `Cancel` ghost + `Save search` primary right.
3. **Lands in the rail + toast.** On save, the new entry slides into the top of the `My searches` group in the left rail and is auto-selected. A noir toast `Search saved — "{name}" · {n} candidates` appears with an `Undo` action (5 s window — deletes the row).
4. **Editing the live search.** Once a saved search is active, any filter/query change flips the toolbar into an "Editing search" state: lilac pill `Editing search` + breadcrumb of the live name + small `N changes` counter, with `Revert` (ghost) and `Save changes` (primary) actions. A `Save as new` ghost button sits next to it for forking.

## Smart auto-name rules

Derived in priority order, joined by ` · ` (max 3 segments, truncate to 48 chars):
1. Primary skill or boolean keyword (e.g. *Design systems*)
2. Seniority or stage (e.g. *Leads*, *Stage: Interview*)
3. Location (e.g. *NYC*, *Remote*)

Fallback: `Saved search · {Mon D}`.

## Files to touch

```text
src/components/candidates/list/
  SaveSearchButton.tsx           NEW   trigger chip + one-time pulse
  SaveSearchPopover.tsx          NEW   the 320px popover form
  SavedSearchToolbar.tsx         EDIT  unsaved-changes pill, N-changes counter, Save as new
  CandidateSearchBar.tsx         EDIT  slot the SaveSearchButton on the right
  CandidatesSearchesRail.tsx     EDIT  highlight-on-mount animation for newly created view

src/lib/
  savedSearchAutoName.ts         NEW   pure helper, fully unit-testable

src/pages/Candidates.tsx         EDIT  wire popover open/close, undo toast, "N changes" diff
```

No new dependencies, no DB migration. `alert_on_new_matches` and `pinned` stored inside `saved_views.extra_state` (already an open jsonb).

## Visual contract

- Popover: shared `menuPanel` chrome (radius 12, pad 4, shadow `0 12px 32px -8px black/18`), 320 px wide, 8 px sideOffset, `align="end"`.
- Name input: 32 h, Inter 13 px, focus ring `virgilio-purple/30`.
- Toggle: existing `Switch` primitive, lilac.
- Save button: default `<Button>` (primary citron-noir).
- Toast: existing noir toast with `Undo` action.
- Editing pill: lilac `bg-virgilio-purple/10 text-virgilio-purple`, 22 h, Poppins 11.5 px medium.
- Rail entry "just saved" treatment: 600 ms cream → lilac fade, no layout shift.
- Honors `prefers-reduced-motion` (pulse + slide-in degrade to opacity only).

## States covered

- Empty filters → `Save as` is disabled with tooltip "Apply a filter first".
- Saving in flight → button shows `Spinner size=12`, form locked.
- Duplicate name in `My searches` → inline error "You already have a search named …".
- Save failed → toast `Couldn't save search · Retry`.
- Active saved search + clean filters → toolbar shows breadcrumb only, no pill.
- Active saved search + dirty filters → pill + Revert + Save changes + Save as new.

## Out of scope (call out in chat after build)

- Real alerting backend (toggle persists but no notifier yet).
- Team sharing (visible but disabled).
- Renaming / deleting from the rail (separate flow).
