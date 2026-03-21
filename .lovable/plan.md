

# Pagination UI, Full-Height Tables, Layout Consistency & Clear Saved Search

## 1. Pagination UI (reference image style)

The image shows a clean pagination bar with: Previous/1/2/3/4/.../6/7/8/Next — pill-shaped page numbers, active page highlighted, Previous/Next with arrow icons.

**`src/components/ui/pagination.tsx`** — Restyle to match:
- Page number buttons: `h-9 w-9 rounded-lg` with `hover:bg-muted` and active state `bg-primary text-white`
- Previous/Next: text + chevron icon, no background, hover underline
- Ellipsis: same sizing
- Overall: `gap-1` horizontal layout, centered

Then create a **`src/components/ui/PaginationControls.tsx`** reusable component that takes `currentPage`, `totalPages`, `onPageChange` and renders the full pagination bar with smart page range (show first/last pages, ellipsis for gaps). This can be dropped into any table.

## 2. Full-height tables for Jobs, Candidates, Pipeline

**Problem**: Jobs, Candidates, and Pipeline pages use `<Section container>` which renders in normal document flow — the table doesn't fill the remaining viewport height, so it doesn't scroll internally like Find does.

**Solution**: Apply the same fixed-viewport pattern from Find to these pages:

**`src/pages/Jobs.tsx`**:
```
- <div>
-   <Section variant="default" banded container>...header...</Section>
-   <Section container>...table...</Section>
- </div>
+ <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden">
+   <Section variant="default" banded className="shrink-0"><AppContainer>...header...</AppContainer></Section>
+   <Section className="flex-1 min-h-0 overflow-hidden !py-0">
+     <AppContainer className="h-full min-h-0">
+       <div className="py-6 h-full min-h-0 overflow-auto">
+         <JobsTable ... />
+       </div>
+     </AppContainer>
+   </Section>
+ </div>
```

Same pattern for **`src/pages/Candidates.tsx`** and **`src/pages/Pipeline.tsx`**.

The `JobsTable`, `IndependentCandidateTable`, and Pipeline's `Accordion` will then scroll within the remaining viewport space, just like Find's results table.

## 3. Layout consistency audit

**Answer to your question**: Yes — all pages use the same `PageHeader` inside `Section variant="default" banded container`, which wraps in `AppContainer` using `layout-container` (max-width: 1500px, centered, same horizontal padding). The headers ARE the same height.

The content sections also all use `Section container` → same `AppContainer` → same max-width and padding. So content starts from the exact same horizontal location on all pages. **No discrepancy exists in width or starting position** — the difference is only that Find uses fixed viewport height while the others scroll the whole page.

After applying change #2, all pages will have identical header height AND content that fills the remaining screen.

## 4. Clear/deselect saved search in Find

**`src/components/sourcing/SavedSearchSelector.tsx`**:
- When a project is selected (`currentProject` exists), show an `X` button on the trigger chip to clear the selection
- Clicking `X` calls `onNewSearch()` which navigates to `/find` and clears the project

```tsx
<button className="inline-flex items-center gap-1.5 rounded-full ...">
  <Bookmark className="h-3.5 w-3.5" />
  {currentProject ? currentProject.name : 'Searches'}
  {currentProject && (
    <span onClick={(e) => { e.stopPropagation(); onNewSearch() }}
      className="ml-0.5 hover:bg-destructive/20 rounded-full p-0.5">
      <X className="h-3 w-3" />
    </span>
  )}
  <ChevronDown className="h-3 w-3 opacity-60" />
</button>
```

## Files

| File | Change |
|------|--------|
| `src/components/ui/pagination.tsx` | Restyle page buttons to match reference image (rounded, active highlight) |
| `src/components/ui/PaginationControls.tsx` | New reusable pagination component with smart page range |
| `src/pages/Jobs.tsx` | Fixed viewport height + flex layout for full-screen table |
| `src/pages/Candidates.tsx` | Fixed viewport height + flex layout for full-screen table |
| `src/pages/Pipeline.tsx` | Fixed viewport height + flex layout for full-screen table |
| `src/components/sourcing/SavedSearchSelector.tsx` | Add X button to clear selected search |

