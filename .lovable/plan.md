
# Dashboard Layout: 2:2:1 Three-Column Grid

## Layout change

**File: `src/pages/Dashboard.tsx`**

Replace the current `lg:grid-cols-2` grid with a 5-column grid using `col-span`:

```
grid-cols-1 → md:grid-cols-3 → xl:grid-cols-5
```

| Breakpoint | Layout |
|-----------|--------|
| Mobile (`<768px`) | Single column, everything stacked |
| Tablet (`md` 768–1279px) | 2:1 → Left col (Application Review + Jobs) spans 2, right col (Tasks + Upcoming) spans 1 |
| Desktop (`xl` 1280px+) | 2:2:1 → Application Review + Jobs \| Tasks \| Upcoming Activities |

### Grid structure (desktop)

```text
┌──────────────┬──────────────┬────────────┐
│ col-span-2   │ col-span-2   │ col-span-1 │
│              │              │            │
│ App Review   │ Tasks        │ Upcoming   │
│ Jobs Overview│              │ Activities │
└──────────────┴──────────────┴────────────┘
```

### Implementation

```tsx
<div className="grid gap-6 grid-cols-1 md:grid-cols-3 xl:grid-cols-5 overflow-hidden">
  {/* Col 1 — Application Review + Jobs */}
  <div className="space-y-6 min-w-0 md:col-span-2 xl:col-span-2">
    <OnboardingChecklist ... />
    {hasJobContent && <ApplicationReviewCard />}
    {hasJobContent && <JobsOverview ... />}
  </div>
  
  {/* Col 2 — Tasks */}
  <div className="space-y-6 min-w-0 md:col-span-1 xl:col-span-2">
    <TasksOverview />
  </div>
  
  {/* Col 3 — Upcoming Activities (narrow) */}
  <div className="space-y-6 min-w-0 md:col-span-3 xl:col-span-1">
    <UpcomingActivities />
  </div>
</div>
```

On tablet (md), the third column spans full width below the other two. On desktop (xl), it sits as the narrow right column.

No changes to UpcomingActivities internals — it stays as-is, just rendered in a narrower container.

## Files changed

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Replace 2-col grid with 5-col grid using col-span for 2:2:1 ratio, adjust responsive breakpoints |
