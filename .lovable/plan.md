# Job posting actions: View posting + manage menu

Two small additions to the Setup tab and job hero, no backend changes.

## 1. "View posting" / "Create job post" button

In `src/components/jobs/JobHero.tsx`, make the posting button adaptive:
- If at least one posting exists → label **"View posting"**, icon `ExternalLink`, opens the first active posting (fallback most recent) in a new tab via `window.open('/p/' + slug, '_blank', 'noopener')`.
- If no postings exist → label **"+ Create job post"**, icon `Plus`, calls a new `onCreatePosting` handler.

In `src/pages/JobDetail.tsx`:
- Compute `activePosting = jobPostings.find(p => p.is_active) ?? jobPostings[0] ?? null`.
- Pass `hasPosting`, `onViewPosting` (opens public URL), and `onCreatePosting` (opens `PostingSheet` in create mode — reuse the same sheet/state already added in the Job posts card, lifted to the page if needed) to `<JobHero>`.

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
