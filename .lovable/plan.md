# Candidate profile hero — match JobHero pattern (Option A)

## Goal

Make the candidate profile top section a bare header (like `JobHero`), with the navigation strip (Back / breadcrumbs / pager) sitting directly above the candidate name in left-center-right distribution. Stage strip and action bar move into their own card below.

## Final structure on `/jobs/:jobId/candidates/:id`

```text
─ Bare header (no card chrome) ─────────────────────────────────────
  ← Back to job        Jobs › Job title › Candidates    7/18 ‹ ›
  ─────────────────────────────────────────────────────────────────
  ⬤  Candidate Name.  ♥  [Stage badge]                  ┌──────┐
      Applying for Job · Source · Applied 3d            │AI Fit│
      [Full profile] [LinkedIn]                         │  87  │
                                                        └──────┘
─ Card: stage strip + action bar ───────────────────────────────────
  ●─●─●─○─○─○   [Advance to Phone Screen]  [Reject] [⋯]
────────────────────────────────────────────────────────────────────

  (rest of page: tabs + main content + quick actions sidebar)
```

Padding/typography mirrors `JobHero`:
- Outer: bare section with `pb-4` (no border, no shadow, no rounded card)
- Title: `font-poppins font-semibold tracking-[-0.04em] text-[28px] sm:text-[32px]`
- Meta row: `text-body-sm text-text-secondary`
- Strip above title: same horizontal rhythm as JobHero's breadcrumb row

## Implementation

### 1. `ProfileHeroCard.tsx` — strip the card, add the nav strip

- Replace `<section className="bg-white border border-virgilio-border rounded-2xl shadow-sm p-5 sm:p-6 space-y-5">` with a bare `<header className="pb-4">`.
- Add new top strip (3-column flex, left-center-right) above the avatar/identity row:
  - Left: `← Back to job` button (calls `onClose`)
  - Center: `Jobs › {jobTitle} › Candidates` breadcrumb (hidden on mobile, same pattern as `JobHero`)
  - Right: `7 of 18 ‹ ›` pager (only when index/total provided)
- Hairline divider (`border-b border-virgilio-border`) between strip and identity row, with `pb-3 mb-4` rhythm.
- Remove `children` slot (stage strip + action bar move out — see step 3).
- Add new props: `onClose`, `index`, `total`, `hasPrev`, `hasNext`, `onNavigatePrev`, `onNavigateNext`.

### 2. Retire `ProfileTopBar.tsx`

The new strip lives inside `ProfileHeroCard` only. Delete `ProfileTopBar.tsx` since it's no longer used (overlay mode also gets the same in-hero strip — see step 4).

### 3. `CandidateProfileSheet.tsx` — restructure

Currently renders (in `asPage` mode):
```
ProfileTopBar
ProfileHeroCard
  └─ children: ProfileStageStrip + ProfileActionBar
ProfileTabs
...
```

New structure:
```
ProfileHeroCard (bare, includes top nav strip)
<section className="bg-white border border-virgilio-border rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
  ProfileStageStrip
  ProfileActionBar
</section>
ProfileTabs
...
```

- Remove the `<ProfileTopBar … />` block.
- Pass `onClose`, `currentIndex`, `totalCount`, `hasPrev`, `hasNext`, `onNavigatePrev`, `onNavigateNext`, `jobTitle` directly to `ProfileHeroCard`.
- Wrap `ProfileStageStrip` + `ProfileActionBar` in their own white card sibling below the hero.
- Apply this structure in **both** modes (`asPage` and overlay) — the in-hero nav strip works for both. In overlay mode, "Back to job" still calls `onClose` (closes the overlay) and the breadcrumb/pager still make sense.

### 4. `CandidateProfile.tsx` (page wrapper)

No prop-shape change required — it already passes `onOpenChange`, `currentIndex`, `totalCount`, `hasPrev`, `hasNext`, `onNavigatePrev`, `onNavigateNext` to `CandidateProfileSheet`. We just need to make sure `jobTitle` reaches the sheet (the sheet already resolves it from the candidate record / job hook — verify and pass through).

### 5. Container alignment with Jobs page

Confirm both pages render their hero inside the same Layout container width and gutter. `Jobs` uses `container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8`; the candidate page should match. If `CandidateProfileSheet` currently uses different padding in `asPage` mode, normalize to the same container.

## Files touched

- `src/components/candidates/profile/ProfileHeroCard.tsx` — bare header + new top strip + new props
- `src/components/candidates/CandidateProfileSheet.tsx` — drop ProfileTopBar, wrap stage strip + action bar in their own card, normalize container padding
- `src/components/candidates/profile/ProfileTopBar.tsx` — delete
- `src/pages/CandidateProfile.tsx` — verify prop pass-through (likely no change)

## Out of scope

- No changes to `JobHero` or the Jobs page.
- No changes to tabs, quick actions sidebar, or application card.
- No backend / RLS / data changes.
- Mobile breakpoint behavior matches `JobHero`: breadcrumb hidden under `md`, pager + back stay visible.
