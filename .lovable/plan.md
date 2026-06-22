
## Goal

Make the Independent (no-job) candidate profile match the in-job profile in **layout dimensions** (page width, hero card width, content column widths, paddings) and use the **same Edit experience** — the existing `CandidateFormSheet` opening cleanly as a right-side sheet, not as a nested/dialog-looking surface.

## Diagnosis

`src/components/candidates/CandidateProfileSheet.tsx` (in-job) is **not** wrapped in a Radix `<Sheet>`. It renders as a fixed-positioned `<div>` with:
- Outer chrome: `fixed top-[4.5rem] left-3 right-3 bottom-3 sm:left-[5.5rem] z-40 bg-background overflow-hidden rounded-2xl ring-1 ring-virgilio-border/60 shadow-calendly`
- Hero band wrapped in `layout-container pt-1 pb-2 sm:pt-2 sm:pb-3`
- Content scroll area wrapped in `pb-10 mx-auto w-full px-4 sm:px-6 pt-4 max-w-[1400px]`
- Content grid: `grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4`

`src/components/candidates/IndependentCandidateProfileSheet.tsx` instead wraps everything in `<Sheet><SheetContent side="right" className="w-[96vw] sm:max-w-none h-full p-0">`. That:
- Produces a different overall width/inset than the in-job page (96vw vs the inset card).
- Uses a 50/50 grid (`grid-cols-1 lg:grid-cols-2`) with `p-6`, so cards render visibly wider than the in-job 1fr+320px grid inside a 1400px max container.
- Causes the nested `<CandidateFormSheet>` (also a right-side Radix Sheet) to render inside another Sheet portal stack — which is what the user sees as a "dialog box" instead of the clean right-side edit sheet they get from the in-job profile.

## Fix (frontend-only, presentation)

### 1. Drop the outer Sheet wrapper in `IndependentCandidateProfileSheet.tsx`

Replace `<Sheet open={open} onOpenChange={onOpenChange}><SheetContent …>` and its closing tags with the same fixed-positioned container the in-job profile uses, gated by `open`:

```tsx
if (!open) return null
return (
  <>
    <div className="fixed top-[4.5rem] left-3 right-3 bottom-3 sm:left-[5.5rem] z-40 bg-background overflow-hidden rounded-2xl ring-1 ring-virgilio-border/60 shadow-calendly">
      <div className="flex h-full w-full">…</div>
    </div>
    {/* CandidateFormSheet, CandidateProfileDownloadDialog, SimpleScheduleInterviewSheet at root */}
  </>
)
```

This:
- Aligns the outer chrome (inset, rounded, shadow) with the in-job profile so width feels identical.
- Removes the nested-Sheet stacking so the Edit `CandidateFormSheet` opens as the same right-side sheet recruiters see from the in-job profile.
- Move `<CandidateFormSheet>` out of the nested layout into the outer fragment so it portals from the root, exactly like in-job (`CandidateProfileSheet.tsx` line ~1897).
- Close ("X") affordance: replace the missing built-in `<SheetContent>` close button with a small ghost icon `Button` in the header row (`X` from lucide), wired to `onOpenChange(false)` — same pattern the in-job sheet uses via its hero card's `onClose`.

### 2. Align the content widths/grid to the in-job profile

Inside the new container, mirror the in-job structure:

- Header band (current `SheetHeader` block): wrap in `<div className="layout-container pt-1 pb-2 sm:pt-2 sm:pb-3 space-y-3 mb-3">…</div>` and keep the existing hero content (name, badges, action buttons, prev/next). No job-specific bits (no stage strip, no Advance, no applied-at) — Independent has no job context, so this stays light but uses the same outer container/padding rhythm.
- Scroll area: `<div className="flex-1 min-h-0 overflow-y-auto"><div className="pb-10 mx-auto w-full px-4 sm:px-6 pt-4 max-w-[1400px]">…</div></div>`
- Replace the current `grid-cols-1 lg:grid-cols-2 gap-6` with `grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4` so cards width-match the in-job profile.
  - Left column keeps its current children (CandidateNameCard / Resume / Overview accordions / Tabs content), wrapped in `space-y-4 min-w-0`.
  - Right column hosts the existing "sidebar-ish" cards (today's right-column content of the Independent profile: CandidateAttachments, CandidateUrls, etc.), wrapped in `space-y-4 min-w-0`. Anything that's currently in the right column of the 50/50 grid moves here unchanged.
- Keep the existing `CandidateJobSidebar` (left rail) as-is; the in-job profile no longer renders one, but in Independent it's the only way to switch between jobs, so it stays.

### 3. Don't change behavior, data, or other components

- No changes to `CandidateFormSheet`, `CandidateProfileSheet`, hooks, or DB.
- Mobile job selector, loading skeleton, AI enrich, Download, Add-to-pipeline, navigation prev/next, schedule sheet — all keep their existing props and handlers; only their wrapper layout moves into the new containers.

## Files touched

- `src/components/candidates/IndependentCandidateProfileSheet.tsx` — outer wrapper swap, header wrapping, content wrapper and grid swap, move `<CandidateFormSheet>` to the outer fragment, add a `X` close button in the header row.

No other files change.

## Validation

- Open a candidate from `/candidates` (no job): outer card has the same inset, radius, shadow, and width as opening one from a job pipeline.
- Cards inside (Overview, Resume, Skills, Experience) render at the same width as the in-job profile (`max-w-[1400px]` with `[minmax(0,1fr)_320px]` grid).
- Click **Edit** in Independent: the right-side `CandidateFormSheet` slides in cleanly — identical to what the in-job Edit button shows.
- Prev/Next, Download, AI Enrich, Add to pipeline, job sidebar selection, mobile job selector all continue to work.
- Closing via the new `X` calls `onOpenChange(false)`; Escape still closes (handled by the same fixed container's keydown is not native — keep current Esc handler if there is one, otherwise rely on the X button + the Candidates page route close).
