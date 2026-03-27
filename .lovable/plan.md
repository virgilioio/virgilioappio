

# Replace Shimmer Bar with Animated Progress Bar

## Change

Replace the shimmer beam div in `SuggestedCandidatesLoader.tsx` with a progress bar that rapidly fills to ~85%, then slowly crawls toward 99% — giving a realistic "almost done" feel.

## Implementation

**File**: `src/components/sourcing/SuggestedCandidatesLoader.tsx`

- Add a `progress` state starting at 0
- Use `useEffect` with `setInterval` (~100ms):
  - While < 85: increment by ~2-3 per tick (reaches 85% in ~3-4 seconds)
  - While < 99: increment by ~0.1-0.2 per tick (crawls slowly, never quite hits 100)
- Replace the shimmer `div` with the shadcn `<Progress>` component, using `value={progress}`
- Style: `w-48 h-1.5`, custom `indicatorClassName` for rounded + primary color

## Visual result

```text
[GioLoader coin flip]
[████████████████████░░░] 85% → slowly crawling...
"Matching skills & experience..."
```

