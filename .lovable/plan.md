

## Fix mobile job detail page — content cut off

### Problem
On mobile, opening a job (`/jobs/:id`) shows the header, tabs, and the top of the "Pipeline Overview" card, but everything below is cut off. The mobile bottom nav also overlaps content. Two compounding bugs:

1. **No scrollable content area.** `JobDetail` wraps everything in `h-[100dvh] ... overflow-hidden`, but the `<TabsContent>` panels for **Job Dashboard**, **Pipeline**, and **Setup** don't have `flex-1 min-h-0 overflow-auto`, so they can't fill or scroll inside the fixed viewport. The Pipeline tab tries to do this with an inner wrapper, but `<TabsContent>` itself isn't a flex child that grows — so the inner `h-full` collapses.
2. **Mobile bottom nav overlap.** The fixed `MobileBottomNav` (~64px + safe-area inset) sits on top of the page, but `JobDetail` doesn't reserve bottom space for it on mobile, so the last ~80px of any scrollable area is hidden behind the nav.

### Fix (single file: `src/pages/JobDetail.tsx`)

**1. Make the Tabs root and each TabsContent a proper flex column on mobile**
- The `<Tabs>` already has `flex-1 min-h-0 flex flex-col overflow-hidden` ✅
- Add to each mobile `<TabsContent value="candidates|pipeline|job-setup">`:
  ```tsx
  className="flex-1 min-h-0 overflow-auto data-[state=inactive]:hidden mt-0"
  ```
  (Radix's TabsContent has `display: none` when inactive; we need the active one to be a real flex child that grows. The `data-[state=inactive]:hidden` keeps that behavior; `mt-0` removes the default margin that breaks the flex layout.)

**2. Reserve bottom space for the mobile bottom nav**
- Update the outer wrapper on mobile only:
  ```tsx
  <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col bg-background overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+72px)] sm:pb-0">
  ```
  This adds ~72px of bottom padding (nav height + breathing room) on mobile, mirroring the safe-area pattern already used in `MobileBottomNav`.

**3. Remove the redundant `mb-6` wrapper around the mobile header**
- `<div className="mb-6">` around `JobDetailMobileHeader` adds 24px gap. Reduce to `mb-3` so more content fits in the constrained mobile viewport.

**4. Pipeline tab inner Card height fix**
- Inside the Pipeline TabsContent, the `<Card className="h-full ...">` will now correctly fill because its parent (TabsContent) is a flex child with `flex-1 min-h-0`. No additional change needed once step 1 lands.

### Out of scope
- Desktop layout (works fine — only the mobile branch is affected).
- Restructuring the Pipeline section selector or the Card header.
- Mobile menu drawer behind the hamburger icon (`onMenuToggle={() => {}}` is currently a no-op — separate ticket if we want to add a drawer with sourcing/assignments shortcuts).

### Files touched
- `src/pages/JobDetail.tsx` — only file. No new components, no CSS, no DB.

