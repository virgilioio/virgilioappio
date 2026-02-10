

# Fix: Edit Job Sheet Width and Skills Panel Responsiveness

## Problem

1. **Width mismatch**: The "Create New Job" wizard is 900px total, but its left sidebar is 256px (`w-64`), making the actual form content area roughly **636px**. The "Edit Job" sheet currently uses `w-[600px] sm:w-[800px]` -- too narrow on mobile (fixed 600px overflows) and too wide on desktop (800px is wider than the wizard's form area).

2. **Skills panel overflow**: When skills are generated, 3 action buttons ("Clear All", "Accept All", "Add Selected") sit in one row with the title. On narrower screens this overflows. The category tabs also use a rigid `grid-cols-7` that cramps on smaller widths.

## Changes

### 1. JobFormSheet.tsx (line 203) -- Match form content width

Change:
```
w-[600px] sm:w-[800px]
```
To:
```
w-full sm:max-w-[640px]
```

- On mobile: fills the screen (`w-full`) instead of forcing 600px
- On desktop: caps at 640px, matching the wizard's form content area (900px minus the 256px sidebar)

### 2. JobSkillsGenerationPanel.tsx (lines 155-211) -- Responsive header buttons

Change the header layout from a single-row `flex items-center justify-between` to a stacking layout:
- Title and buttons wrap to separate lines on smaller screens using `flex flex-col sm:flex-row gap-2`
- Action buttons group uses `flex flex-wrap gap-2` so they wrap gracefully

### 3. JobSkillsGenerationPanel.tsx (line 227) -- Responsive category tabs

Change `TabsList` from `grid grid-cols-7` to `flex flex-wrap h-auto gap-1` so tabs wrap to multiple rows instead of cramming into 7 fixed columns.

### 4. SkillsGenerationPanel.tsx -- Same fixes for consistency

Apply the identical header-stacking and tabs-wrapping fixes to the candidate-side skills panel, which shares the same layout patterns (lines ~120-196).

## No functionality changes -- pure CSS/layout adjustments.

