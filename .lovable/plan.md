
## Diagnosis (why widths still differ)

Re-comparing the two surfaces the user sees:

- **In-job** (`/jobs/:jobId/candidates/:id`) renders `CandidateProfileSheet` with `asPage`. Outer chrome is full-viewport (`h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col bg-background overflow-hidden`), there is **no left rail**, and the scroll inner wrapper uses `layout-container pb-10 mx-auto w-full` (max-width = `--layout-max-width` = **1500px**, with `--spacing-lg` side padding).
- **Independent** (after my last change) uses the inset-card chrome (`fixed top-[4.5rem] left-3 right-3 bottom-3 sm:left-[5.5rem] … rounded-2xl ring-1 shadow-calendly`), still keeps the `CandidateJobSidebar` left rail (eats ~240–280px on `lg+`), and the scroll inner wrapper uses `max-w-[1400px]`.

Three concrete reasons the cards look narrower in Independent:
1. `max-w-[1400px]` vs `layout-container` (1500px).
2. The persistent left rail (`CandidateJobSidebar`) consumes horizontal space before the 1400px centered area is computed.
3. The outer card insets (`left-[5.5rem] right-3` instead of full-width) further shrink the available area on the right.

## Fix (frontend layout only)

All changes scoped to `src/components/candidates/IndependentCandidateProfileSheet.tsx`. No logic, hooks, or other files touched.

### 1. Match the in-job `asPage` chrome

Replace the inset rounded-card wrapper with the same full-viewport flex column the in-job profile uses:

```tsx
<div className="fixed inset-0 z-40 h-[100dvh] sm:h-[calc(100dvh-3.5rem)] sm:top-14 flex flex-col bg-background overflow-hidden">
  <div className="flex w-full flex-1 min-h-0">
    …
  </div>
</div>
```

This gives Independent the same vertical sizing and (after step 2) the same horizontal area as in-job.

### 2. Remove the persistent left rail; surface job switching in the header

`CandidateJobSidebar` is dropped from the main flex row. To keep the ability to switch between the candidate's jobs, the header band gets a compact **"Open in job"** action — a small `DropdownMenu` button (Briefcase icon) whose items come from the existing `useCandidateJobs(candidateId)` hook the sidebar already uses. Selecting an entry calls the same `handleJobSelect(jobId)` we have today (navigates to `/jobs/:jobId/candidates/:candidateId`).

`MobileJobSelector` (the mobile-only inline selector) is kept on `lg:hidden` widths as today — no change.

### 3. Use `layout-container` for both header and scroll inner wrapper

- Header band: `layout-container pt-1 pb-2 sm:pt-2 sm:pb-3 space-y-3 mb-3 border-b` (mirrors in-job).
- Scroll inner: `layout-container pb-10 mx-auto w-full` (drop the `max-w-[1400px]`/`px-4 sm:px-6 pt-4` shorthand). Add `pt-4` after the container utility if needed for the same top breathing room as in-job.
- Keep `grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4` (already matches in-job).

### 4. Keep everything else

- `<CandidateFormSheet>` stays at the outer fragment root (already done) → Edit slides in the same right-side sheet as in-job.
- `X` close button stays in the header right-cluster, wired to `onOpenChange(false)`.
- Loading skeleton, AI Enrich, Download, Add to pipeline, Prev/Next, schedule sheet — unchanged.

## Files touched

- `src/components/candidates/IndependentCandidateProfileSheet.tsx` only.

## Validation

- Open `/candidates?openCandidate=<id>` and the same candidate via `/jobs/<jobId>/candidates/<id>` side by side at 1280–1440px wide. The hero band, content area, left card column, and right 320px column all measure identically — both centered inside a 1500px `layout-container` with `--spacing-lg` side padding. No left rail in either surface.
- The "Open in job" dropdown in Independent lists the candidate's jobs and navigates to the in-job route on select.
- Edit still opens the `CandidateFormSheet` from the root (unchanged behavior).
