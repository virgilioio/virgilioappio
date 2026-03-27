

# Add Gio Thinking Animation to Suggested Candidates Loading

## What changes

Replace the plain skeleton loaders in the Suggested Candidates tab with the `GioThinkingHeader` component (coin-flipping avatar + rotating status messages + shimmer bar), matching the Find page's loading experience.

## Thinking messages

Swap the Find-page messages for suggested-candidates-specific ones:

```
"Scanning your talent pool"
"Analyzing job requirements"
"Matching skills & experience"
"Evaluating candidate fit"
"Ranking best matches"
"Finding your people"
```

## Implementation

### 1. New component: `SuggestedCandidatesLoader.tsx`

A thin wrapper around `GioLoader` (coin-flip avatar) with its own `THINKING_MESSAGES` array and the same shimmer bar + rotating text pattern from `GioThinkingHeader`, but with suggested-candidates-specific copy. Keeps `GioThinkingHeader` unchanged for the Find page.

### 2. Update `JobDetail.tsx` (two places: mobile ~line 1178 and desktop ~line 1593)

Replace the skeleton `div` block:
```tsx
// Before
{isLoadingMatches ? (
  <div className="space-y-3 py-4">
    {Array.from({ length: 4 }).map(...skeleton...)}
  </div>
)
// After
{isLoadingMatches ? (
  <div className="flex items-center justify-center py-12">
    <SuggestedCandidatesLoader />
  </div>
)
```

## Files changed

| File | Change |
|------|--------|
| `src/components/sourcing/SuggestedCandidatesLoader.tsx` | New component — GioLoader + rotating messages |
| `src/pages/JobDetail.tsx` | Replace skeleton blocks (2 places) with the new loader |

