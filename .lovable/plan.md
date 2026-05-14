## Goal

Replace the generic gray-slab loading states on the Job page and the Candidate Profile page with two pixel-faithful skeletons that mirror the actual cards we ship today:

1. **Hero card skeleton** — matches `JobHero` / `ProfileHeroCard` (white card · radius 2xl · hairline · breadcrumb · big H1 + purple dot · meta row · right-side action cluster · tabs row inside the card).
2. **Stages/Status bar skeleton** — matches `PipelineSectionTabs` (Job page, 6 colored section tabs in a card) and `ProfileStageStrip` (Candidate profile, horizontal stage chips in a card).

Both skeletons live inside the same outer card chrome (`bg-white border border-virgilio-border rounded-2xl shadow-sm`) so the page doesn't reflow when real data lands.

## What I'll add

### 1. New shared file `src/components/ui/hero-skeletons.tsx`
Exports:
- **`HeroCardSkeleton`** — variant prop `"job" | "candidate"`
  - Outer chrome: same card classes as the live heroes (`px-6 pt-5`)
  - Top strip:
    - `job`: small breadcrumb pill (60w) + nothing on the right
    - `candidate`: "Back to job" pill + breadcrumb crumbs + right-side fit pill / action buttons (Advance, Schedule, Email, prev/next)
  - H1 row: 280×32 bar + a 6×6 purple dot (real `bg-virgilio-purple/30` square) so the visual signature is instantly recognisable
  - Meta row: 4–5 short bars (status pill 64w, location 80w, dept 90w, posted 110w, hiring team 6×6 stack of 3 + label)
  - Tabs row at the bottom flush with the card edge: 6 thin underline-tab placeholders
- **`PipelineSectionTabsSkeleton`** — 6 equal-width rounded `xl` cells inside a card (`p-5 sm:p-6`), matching the `PipelineSectionTabs` shape: each cell shows an icon dot + label bar + count bar
- **`StageStripSkeleton`** — horizontal row of 6 stage chips (h-9, rounded-full) inside the same card chrome, matching `ProfileStageStrip`

All bars use the existing `<Skeleton>` primitive (`bg-muted` shimmer); no new tokens.

### 2. Wire skeletons into the two pages

- **`src/pages/JobDetail.tsx` (lines 814–835)** — replace the generic 8×Skeleton block with:
  ```
  layout-container > h-[100dvh] flex-col
    <HeroCardSkeleton variant="job" />
    <PipelineSectionTabsSkeleton />
    <TableSkeleton rows={6} />   // already exists in our table primitives
  ```
  Keeps the same outer wrapper as the loaded state, so dimensions don't shift.

- **`src/components/candidates/CandidateProfileSkeleton.tsx`** — replace the current name-card+two-column placeholder with:
  ```
  <HeroCardSkeleton variant="candidate" />
  <StageStripSkeleton />
  // keep the existing two-column body skeleton below for the tab content
  ```
  This preserves `CandidateProfileSkeleton` as the single entry point used by `CandidateProfileSheet` and `IndependentCandidateProfileSheet` — no consumer changes.

### 3. No business-logic changes
- `JobHero`, `ProfileHeroCard`, `PipelineSectionTabs`, `ProfileStageStrip` are untouched
- No new design tokens, no Tailwind config changes — uses existing `<Skeleton>`, `virgilio-border`, `virgilio-purple/30`, rounded-2xl

## Out of scope
- Mobile-only header skeleton (mobile job page uses a different bar that already loads instantly)
- Tab-content skeletons inside the candidate profile right-column body (kept as-is)
- Sheet/drawer chrome skeletons

## Verification
- Hard-reload `/jobs/:id` → see hero card outline + 6 colored section tabs outline + table skeleton, then real content swaps in without layout jump
- Hard-reload `/jobs/:id/candidates/:cid` → see candidate hero card outline + horizontal stage strip outline, then content fills in
- Open candidate sheet from the pipeline → same hero + strip skeleton appears for the brief load window

Ready to implement on approval.