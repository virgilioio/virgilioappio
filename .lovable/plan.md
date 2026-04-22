
## Fix the actual mobile Pipeline view in Job Detail

### What’s actually wrong
The screen in the screenshot is not `PipelineOverviewTable.tsx` (analytics). It is the **Job Detail > Pipeline** view rendered in `src/pages/JobDetail.tsx` with `src/components/jobs/PipelineOverview.tsx`.

The mobile layout is still collapsing because:
1. The pipeline tab stacks a **section selector card** above the main **Pipeline Overview** card.
2. The main card is still `h-full`, but it sits under another sibling inside a non-column-flex wrapper, so it tries to take the full parent height anyway.
3. Its body uses `CardContent className="p-0 h-0 flex-1"`, which only works when the parent height math is correct. On mobile Safari / small viewports, that content area collapses into a thin strip.

That is why users only see the header and a sliver of the pipeline board.

## Implementation

### File: `src/pages/JobDetail.tsx`

#### 1. Fix the mobile pipeline container structure
In the mobile `TabsContent value="pipeline"` branch, change the immediate wrapper from a generic scroll block into a real column flex layout:
- Current pattern:
  ```tsx
  <div className="flex-1 min-h-0 overflow-auto">
  ```
- Change to:
  ```tsx
  <div className="flex h-full min-h-0 flex-col">
  ```

This lets the selector card sit on top and the main pipeline card consume the remaining vertical space correctly.

#### 2. Keep the top selector card from stealing layout height unpredictably
The small card containing the mobile section selector (`Recruiting Process`, counts, chevron) should become a fixed-height flex child:
- add `shrink-0` to that card
- keep its bottom margin/gap, but do not let it participate in height stretching

#### 3. Replace the main Pipeline Overview card’s `h-full` with a flex-based layout
For the large card that contains:
- “Pipeline Overview”
- Add Candidate / Select / board/list controls
- the actual pipeline board/list content

change:
```tsx
<Card className="h-full w-full overflow-hidden flex flex-col">
```
to a layout that fills the remaining space instead of forcing full parent height:
```tsx
<Card className="w-full flex flex-col flex-1 min-h-0 overflow-hidden">
```

On mobile, also add a minimum viewport-based floor so the card never becomes tiny:
```tsx
min-h-[60dvh] sm:min-h-0
```

Final idea:
```tsx
<Card className="w-full flex flex-col flex-1 min-h-[60dvh] sm:min-h-0 overflow-hidden">
```

This ensures the pipeline area is visibly tall even after the header + selector card.

#### 4. Stop collapsing the card body with `h-0`
Change:
```tsx
<CardContent className="p-0 h-0 flex-1">
```
to:
```tsx
<CardContent className="p-0 flex-1 min-h-0">
```

That gives the content area a real flexible height instead of forcing it to start at zero.

#### 5. Give the mobile pipeline content wrapper a real visible floor
Inside the recruiting board path, update the mobile wrapper from:
```tsx
<div className="h-full w-full overflow-y-auto sm:hidden p-layout-md">
```
to something that guarantees usable vertical space on phones:
```tsx
<div className="h-full min-h-[48dvh] w-full overflow-y-auto sm:hidden p-layout-md">
```

If testing still feels tight on 390×844, increase that floor to `min-h-[52dvh]`.

Do the same for the non-board/mobile path if needed so list mode and other pipeline sections don’t collapse either.

#### 6. Apply the same fix to the duplicated pipeline block
`JobDetail.tsx` contains two nearly identical pipeline render blocks. Update both instances so mobile and non-mobile branches don’t drift again:
- the one around the first `Pipeline Overview` card block
- the duplicated one later in the file

### Optional hardening
If the mobile branch still feels cramped after the flex fix, reduce only the mobile pipeline card header spacing slightly:
- tighten header padding
- keep desktop untouched

This should be a fallback only if needed after the height fix.

## Files touched
- `src/pages/JobDetail.tsx`

## Explicitly out of scope
- `src/components/analytics/PipelineOverviewTable.tsx` — unrelated to this production screen
- Refactoring `PipelineOverview.tsx` unless the `JobDetail.tsx` height fix proves insufficient
- Desktop pipeline layout

## Verification
On a 390×844 viewport, open a job → Pipeline tab and confirm:
1. The “Pipeline Overview” card shows a **substantial content area**, not just the header.
2. At least the top portion of the actual pipeline board/list is clearly visible without feeling cut off.
3. The user can scroll the pipeline content normally on mobile.
4. Desktop behavior remains unchanged.
