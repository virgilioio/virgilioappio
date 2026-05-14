## Match candidate hero top-right buttons to Job hero exactly

**File:** `src/components/candidates/profile/ProfileHeroCard.tsx`

JobHero uses `size="md"` (34h, 13px text, 14 icon) for every right-cluster button. Candidate hero currently uses `size="sm"` (28h). One change: bump them all to `md`.

### Changes (right cluster only)

1. `Advance to {nextStageLabel}` button — `size="sm"` → `size="md"`
2. `Schedule` button — `size="sm"` → `size="md"`
3. `Email` button — `size="sm"` → `size="md"`
4. Prev/Next chevron iconOnly buttons — `size="sm"` → `size="md"`
5. AI Fit chip — bump from `h-8` (32px) → `h-[34px]` so it lines up with the new md buttons. Keep all other styling.

Nothing else changes: identity row, breadcrumb, Back-to-job link, tab slot, and JobHero itself stay untouched.