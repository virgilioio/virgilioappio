

# Redesign Application Review Sheet — 3-Column Layout

## Current State
- The `ApplicationReviewSheet` is a narrow sheet (`sm:max-w-2xl lg:max-w-3xl`) with a single scrolling column showing candidate header → metadata chips → application responses → resume → AI summary, and a sticky bottom action bar.
- The `CandidateProfileSheet` is full-width (`w-[96vw] sm:max-w-none`) with a name header using `font-poppins font-bold text-4xl` + purple period + LinkedIn button + job badge subtitle.

## Changes

### 1. Match sheet width to CandidateProfileSheet
In `ApplicationReviewSheet.tsx`, change the `SheetContent` className from:
```
w-full sm:max-w-2xl lg:max-w-3xl
```
to:
```
w-[96vw] sm:max-w-none
```

### 2. Match candidate name/subtitle to CandidateProfileSheet header
Replace the current candidate header block (name + job title + nav buttons) with the same pattern used in `CandidateProfileSheet`:
- `font-poppins font-bold tracking-page-title text-text-primary text-4xl` for the name
- Purple period (`.`) after the name
- LinkedIn button next to the name (same icon button style)
- Job badge + metadata chips as subtitle row below
- Previous/Next navigation buttons aligned to the right (same style)

### 3. Restructure content into a 2:1:1 three-column grid
Replace the current single-column `ScrollArea` content with a `grid grid-cols-4 gap-6` layout:

**Column 1 (col-span-2) — Resume**
- Full `CandidateResumeViewer` filling the column height
- AI Career Summary below if available

**Column 2 (col-span-1) — Application Responses**
- `CandidateApplicationResponses` component in a scrollable area

**Column 3 (col-span-1) — Review Controls**
- Rejection settings panel (currently hidden behind a popover — now always visible inline):
  - Rejection reason selector
  - Notes textarea
  - Send email toggle
- Action buttons stack (Reject / Pass / Advance) at the bottom of this column
- Session progress badge (X of Y) displayed here

### 4. Remove the sticky bottom action bar
Since the action buttons now live in column 3, the bottom action bar is removed entirely.

### 5. Files modified
- `src/components/candidates/ApplicationReviewSheet.tsx` — all layout, header, and structural changes

### Technical notes
- The `RejectionConfigPanel` inner component is reused but rendered inline in column 3 instead of inside a `Popover`.
- `CandidateResumeViewer` and `CandidateApplicationResponses` are already imported/used — just repositioned into the grid.
- Loading, empty, and completion states remain full-width centered (they don't need the 3-column layout).

