# Job posting actions: View posting + manage menu

Two small additions to the Setup tab and job hero, no backend changes.

## 1. "View posting" opens the public job post

In `src/pages/JobDetail.tsx`:
- Pick the first **active** posting (fallback to most recent) from `jobPostings`.
- Set `hasPosting` = there is at least one active posting.
- Wire `onViewPosting` to `window.open('/p/' + posting.slug, '_blank', 'noopener')`.
- Disabled state stays the same when no active posting exists (tooltip already in `JobHero`).

## 2. Toggle + ellipsis menu on each Job posts card row

In `src/components/jobs/JobSetupLayout.tsx`, replace the static badge on the right of each posting row with:

- A `<Switch>` bound to `p.is_active` → calls `updatePosting(p.id, { is_active: !p.is_active })`. Stops row click propagation.
- An ellipsis `<DropdownMenu>` (align="end", sideOffset 8) with these items in order:
  - **Edit** → opens `PostingSheet` in edit mode (same as row click).
  - **Duplicate** → `duplicatePosting(p.id)` then `refetchPostings`.
  - **Copy URL** → `navigator.clipboard.writeText(window.location.origin + '/p/' + p.slug)` + toast "Link copied".
  - divider
  - **Delete** (danger, last) → confirm then `deletePosting(p.id)`.

Re-add `updatePosting` and `duplicatePosting` to the `useJobPostings` destructuring (currently only `postings`/`refetch` are pulled). Toggle and menu are admin-only (hidden when `isReadOnly`). Row click still opens `PostingSheet` for edit.

## Files

- Edit `src/pages/JobDetail.tsx` (View posting wiring).
- Edit `src/components/jobs/JobSetupLayout.tsx` (Switch + ellipsis menu per row).

## Out of scope

No changes to `PostingSheet`, `useJobPostings` hook internals, public posting page, or RLS.
