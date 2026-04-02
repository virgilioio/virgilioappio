

# Application Review Card: Add Show More Toggle, Job Status Badge & Location

## Changes

### 1. Extend hook to include job status and location

**File: `src/hooks/useApplicationReviewCounts.ts`**

- Add `jobStatus` and `jobLocation` fields to `ApplicationReviewCount` interface
- Pull them from the existing `jobs` array (already available via `useJobs()`) when building results

### 2. Update card rows to match JobsOverview layout + add show more toggle

**File: `src/components/dashboard/ApplicationReviewCard.tsx`**

**Row layout** — match the exact JobsOverview pattern:
- Top line: job title (truncated) + `Badge` with status variant (`job-open`, `job-draft`, etc.)
- Second line: location with `MapPin` icon (if present), same `text-xs text-muted-foreground` styling
- Right side: count badge + `ChevronRight`
- Use `flex items-start` (not `items-center`) like JobsOverview

**Show more/less toggle** — replace static `<p>+N more</p>` with:
- `useState` for `showAll`
- `<Button variant="ghost" size="sm" className="w-full mt-2">` showing "Show N more" / "Show less"
- Same pattern as other dashboard cards

**New imports**: `Badge`, `MapPin`, `Button`, `useState`

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useApplicationReviewCounts.ts` | Add `jobStatus` and `jobLocation` to interface and results |
| `src/components/dashboard/ApplicationReviewCard.tsx` | Match JobsOverview row style (status badge, location), add interactive show more/less |

