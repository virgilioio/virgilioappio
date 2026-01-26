

# Mobile Optimization Plan

This plan addresses the identified mobile UX issues across multiple components while preserving all existing functionality. The changes focus on responsive design improvements, better space utilization, and accessibility enhancements for mobile users.

---

## Summary of Issues & Solutions

### 1. Navigation Menu - Platform Admin Indicator
**Problem**: The admin mode indicator uses amber colors that don't match the GoGio style guide, and the badge/text layout is disproportionate in the mobile navigation drawer.

**Solution**:
- Update `AdminModeIndicator` to use GoGio brand colors (virgilio-purple palette)
- Restructure the layout to stack badge and text vertically on mobile for better proportions
- Use `flex-col` on small screens and `flex-row` on larger screens

### 2. Dashboard Cards - Horizontal Scroll
**Problem**: Dashboard cards cause horizontal overflow on mobile, creating an "imperfect" feel despite functional accessibility.

**Solution**:
- Add `min-w-0` and `overflow-hidden` to dashboard grid containers
- Ensure card content uses `truncate` classes for long text
- Add responsive padding adjustments for mobile
- Verify the `layout-container` mobile breakpoint is properly constraining content

### 3. Job Pipeline Overview - Status Tabs Cramping
**Problem**: The 6-column status tabs (Suggested, Application Review, Recruiting Process, Job Offers, Hired Candidates, Rejected Candidates) are cramped and unreadable on mobile.

**Solution**:
- Replace the fixed 6-column grid with a dropdown `Select` component on mobile
- Default to "Recruiting Process" tab when in mobile dropdown mode
- Hide the helper text "Drag candidates across stages..." on mobile
- Auto-switch to list view on mobile for better accessibility
- Keep board/list toggle visible but default to list on mobile

### 4. Candidate Profile Sheet - Broken Layout
**Problem**: The candidate profile sheet layout completely breaks on mobile. The job associations sidebar takes up too much space.

**Solution**:
- Convert the sidebar to a dropdown selector on mobile (`md:` breakpoint)
- Restructure the header to stack navigation buttons vertically on mobile
- Make action buttons in the controls card scrollable/wrap properly
- Adjust the two-column grid to single column on mobile (already `lg:grid-cols-2`, but needs content adjustments)

### 5. Pipeline Page Accordions - Kanban Not Scrollable
**Problem**: When opening a job accordion on the Pipeline page, the embedded Kanban board is not scrollable, making candidates inaccessible on mobile.

**Solution**:
- Add `overflow-x-auto` to the Kanban container within accordions
- Consider adding a "List View" option for mobile within the accordion content
- Add proper touch scrolling hints

---

## Technical Implementation Details

### File: `src/components/admin/AdminModeIndicator.tsx`

Current structure uses `flex items-center gap-2` with nested horizontal layout. Update to:

```text
Before (horizontal, cramped):
┌──────────────────────────────────────────┐
│ [Shield] [Badge: Platform Admin] [Text] │
└──────────────────────────────────────────┘

After (responsive, stacked on mobile):
Mobile:
┌──────────────────────────────────────────┐
│ [Shield] [Badge: Platform Admin]         │
│          You're viewing all orgs         │
└──────────────────────────────────────────┘

Desktop (unchanged):
┌──────────────────────────────────────────┐
│ [Shield] [Badge] You're viewing all orgs │
└──────────────────────────────────────────┘
```

Changes:
- Replace `bg-amber-*` colors with `bg-virgilio-purple/10`, `border-virgilio-purple/30`
- Replace `text-amber-*` colors with `text-virgilio-purple`
- Add responsive flex direction: `flex-col sm:flex-row`
- Reduce text length on mobile: show abbreviated text

---

### File: `src/pages/Dashboard.tsx`

Add overflow protection to the grid container:
- Wrap the grid in `overflow-hidden` container
- Ensure all child cards have `min-w-0` for proper flexbox shrinking

---

### File: `src/pages/JobDetail.tsx`

**Status Tabs Mobile Optimization (lines ~898-938)**

Create a new mobile-only dropdown selector component and conditionally render:

```text
Desktop: 6-column TabsList (unchanged)
Mobile: Select dropdown with all 6 options
```

Implementation approach:
- Use `useIsMobile()` hook (already imported)
- Wrap TabsList in `hidden md:grid` for desktop
- Add a `Select` component for mobile with same tab values
- Both control the same `pipelineSectionTab` state

**Pipeline Description Text**
- Add `hidden md:block` to the paragraph with "Drag candidates across stages..."
- On mobile, show a shorter hint or nothing

**Default View Mode**
- Update `pipelineView` initialization to check `isMobile` and default to `'list'`

---

### File: `src/components/candidates/CandidateProfileSheet.tsx`

**Job Sidebar to Dropdown (lines ~707-715)**

Current:
```tsx
<CandidateJobSidebar candidateId={candidateId} ... />
```

Update to:
- Hide sidebar on mobile: `className="hidden lg:block"`
- Add mobile dropdown above the main content that shows when `!lg`:

```text
Mobile layout:
┌─────────────────────────────────────────┐
│ [Dropdown: Select Job Association ▼]    │
├─────────────────────────────────────────┤
│ [Header with navigation]                │
├─────────────────────────────────────────┤
│ [Content - single column]               │
└─────────────────────────────────────────┘
```

**Header Navigation Buttons (lines ~744-765)**
- Stack Previous/Next buttons vertically or make them icon-only on mobile
- Add responsive classes: `hidden sm:inline` for text labels

**Controls Card Actions (lines ~803-879)**
- Wrap action buttons in `flex-wrap gap-2` to allow natural wrapping
- Add `overflow-x-auto` fallback if needed

---

### File: `src/components/candidates/IndependentCandidateProfileSheet.tsx`

Apply similar changes as CandidateProfileSheet:
- Sidebar is already `hidden lg:block` (line 297-299)
- Ensure header navigation is responsive
- Add mobile dropdown for job associations

---

### File: `src/components/pipeline/JobRow.tsx`

**Scrollable Kanban in Accordion (lines ~108-112)**

Update the embedded PipelineOverview container:

```tsx
// Before
<div className="mt-4">
  <PipelineOverview jobId={job.id} showHeader={false} externalScroll={true} />
</div>

// After
<div className="mt-4 overflow-x-auto -mx-4 px-4">
  <PipelineOverview jobId={job.id} showHeader={false} externalScroll={false} />
</div>
```

Key changes:
- Remove `externalScroll={true}` so PipelineOverview manages its own scroll
- Add `overflow-x-auto` to allow horizontal scrolling
- Use negative margins + padding trick to allow edge-to-edge scrolling

**Mobile List View Consideration**
- For a future enhancement, could add a prop to force list view on mobile within accordions

---

### File: `src/components/jobs/PipelineOverview.tsx`

**Helper Text (lines ~529-531)**
- Add `hidden md:block` to hide the subtitle on mobile

**Mobile Default View**
- Add logic to check viewport and default to list view on mobile:
```tsx
const isMobile = useIsMobile()
const [internalViewMode, setInternalViewMode] = useState<'board' | 'list'>(() => {
  return isMobile ? 'list' : 'board'
})
```

---

## New Component: Mobile Status Tab Selector

Create a reusable component for the mobile status tabs dropdown:

```tsx
// src/components/jobs/MobileStatusTabSelector.tsx
interface MobileStatusTabSelectorProps {
  value: string
  onValueChange: (value: string) => void
  tabs: Array<{ value: string; label: string; count: number; variant: string }>
}
```

This component renders a Select dropdown with the same styling as the tab variants.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/AdminModeIndicator.tsx` | Restyle with brand colors, responsive stacking |
| `src/pages/Dashboard.tsx` | Add overflow protection to grid |
| `src/pages/JobDetail.tsx` | Mobile dropdown for status tabs, hide helper text |
| `src/components/candidates/CandidateProfileSheet.tsx` | Sidebar to dropdown, responsive header, wrapping buttons |
| `src/components/candidates/IndependentCandidateProfileSheet.tsx` | Same as above |
| `src/components/pipeline/JobRow.tsx` | Enable scroll in accordion Kanban |
| `src/components/jobs/PipelineOverview.tsx` | Hide subtitle on mobile, default to list view |

---

## Testing Checklist

After implementation, verify:
1. Navigation drawer shows properly styled admin indicator
2. Dashboard cards don't cause horizontal scroll on mobile
3. Job Pipeline status tabs are selectable via dropdown on mobile
4. Candidate profile sheet displays correctly on mobile with job dropdown
5. Pipeline page accordions allow scrolling through Kanban columns
6. All existing functionality remains intact (drag-and-drop, navigation, actions)

---

## Notes

- All changes use existing Tailwind breakpoints (`sm:`, `md:`, `lg:`)
- No new dependencies required
- Changes are backward-compatible with desktop views
- The `useIsMobile()` hook is already available in the codebase

