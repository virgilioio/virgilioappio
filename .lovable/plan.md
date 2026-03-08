

# Unified Filter UI — Stripe-Inspired Horizontal Filter Bar + Sheet Pattern

## Current State
Two completely different filter UIs:
- **Talent Intelligence**: Horizontal bar with `MultiSelect` dropdowns + "More Filters" sheet with more `MultiSelect` dropdowns
- **Candidates**: Collapsible grid panel with `Popover+Command` dropdowns

Both look inconsistent and don't match the Stripe-inspired pattern the user wants.

## Target Pattern (from both reference images)
1. **Horizontal filter chip bar** — pill-shaped buttons showing filter name + active value. Clicking opens a **popover with checkbox list** (not a dropdown select). Like Stripe's `⊕ Status | Failed ▾` chips.
2. **Active filter chips** below the bar showing selected values as dismissible pills
3. **"More Filters" button** opens a **Sheet** for overflow/advanced filters (experience slider, date range, etc.)
4. **"Clear Filters"** link when any are active

## New Shared Components

### 1. `src/components/ui/filter-chip-popover.tsx`
A reusable filter chip that:
- Shows as a pill/chip button: `⊕ Label` when empty, `Label | value ▾` when active
- On click, opens a Popover with a **checkbox list** (with optional search input when >8 options)
- Each option shows: `☐ Label (count)`
- Checked items use `primary` color (Virgilio purple checkbox)
- Bottom of popover: "Apply" button (primary purple, full-width like Stripe)
- Chip gets a highlighted state (subtle purple bg) when filter is active
- Font: `font-poppins` for chip label, item labels

### 2. `src/components/ui/filter-bar.tsx`
A horizontal flex container that:
- Renders a row of `FilterChipPopover` components
- Adds a "More Filters" button (with `SlidersHorizontal` icon) at the end
- Shows a "✕ Clear Filters" link when any filters are active
- Below: renders active filter chips as dismissible `Badge variant="purple"` pills

### 3. Update `src/components/ui/filter-sheet.tsx`
Reusable sheet wrapper for "More Filters":
- Header with title + description
- Scrollable content with filter sections using `FilterCheckboxGroup` (inline checkbox lists, not dropdowns)
- Sticky footer: "Clear all" (ghost) + "Apply" (primary) buttons

### 4. `src/components/ui/filter-checkbox-group.tsx`
For use inside the filter sheet — a labeled section with:
- Section label (uppercase, xs, muted)
- Optional search input
- Visible checkbox list with counts
- "Show N more" toggle when >6 options

## Page Updates

### Talent Intelligence (`TalentIntelligenceFilterBar.tsx`)
Replace current `MultiSelect` dropdowns with `FilterChipPopover` for: Role, Seniority, Country, Skills.
Keep Salary slider inline. "More Filters" opens sheet with: Functional Area, Specialization, State, City, Experience, Date.

### Candidates (`IndependentCandidateTable.tsx` + `CandidateFiltersPanel.tsx`)
- Replace collapsible grid panel with a **horizontal filter bar** using `FilterChipPopover` for: Status, Source, Country, Seniority, Skills
- "More Filters" button opens a **Sheet** with: State, City, Functional Area, Specialization, Enrichment Status, Experience slider, Salary slider, Date range
- Active chips row below the bar (reuse the same `ActiveFilterChips` pattern from Talent Intelligence)

## Visual Spec (Virgilio branding)
- **Chip default**: `border border-border rounded-full px-3 h-8 text-sm font-poppins` with `+` icon prefix
- **Chip active**: `bg-accent/40 border-accent-foreground/30` with value shown after `|` separator
- **Popover**: `w-[240px]`, search input at top, checkbox list, full-width purple "Apply" button at bottom
- **Checkboxes**: `data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground`
- **Active chips**: `Badge variant="purple"` with `X` dismiss button (existing pattern)
- **Clear Filters**: ghost button, `text-muted-foreground`

## Files to Create
1. `src/components/ui/filter-chip-popover.tsx`
2. `src/components/ui/filter-checkbox-group.tsx`
3. `src/components/ui/filter-sheet.tsx`

## Files to Modify
1. `src/components/talent-intelligence/TalentIntelligenceFilterBar.tsx` — use new chip popovers
2. `src/components/talent-intelligence/TalentIntelligenceFilterSheet.tsx` — use new checkbox groups + sheet wrapper
3. `src/components/candidates/CandidateFiltersPanel.tsx` — rewrite as horizontal filter bar + sheet
4. `src/components/candidates/IndependentCandidateTable.tsx` — remove collapsible, use new bar layout

