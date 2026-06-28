# Fix Analytics empty state to use canonical structure

## Problem

The Analytics page renders a custom, hand-built "This view is empty" block when a view has no widgets. It uses raw divs, dashed border, a `LayoutGrid` lucide icon in a grey circle, and a custom purple button — none of which match our canonical empty-state system (`<EmptyState>` + `<EmptyAction>` + `SoftChart` illustration).

Location: `src/components/analytics/WidgetGrid.tsx` lines 62–80.

Note: a deprecated wrapper `AnalyticsEmptyState` exists and other analytics surfaces (charts, tables, sections) already use `EmptyState` correctly. Only the top-level Analytics dashboard empty state is non-compliant.

## Change

Replace the custom block in `WidgetGrid.tsx` with the canonical primitive:

```tsx
<EmptyState
  size="card"
  illustration={<SoftChart />}
  title="This view is empty"
  body="Add a widget to start building your dashboard."
  primary={
    <EmptyAction icon={<Plus size={16} />} onClick={add}>
      Add your first widget
    </EmptyAction>
  }
/>
```

- Import `EmptyState`, `EmptyAction` from `@/components/ui/empty-state`.
- Import `SoftChart` from `@/components/ui/EmptyIllustrations`.
- Swap the `LayoutGrid` icon import for `Plus` (used in the action button).
- Remove the unused dashed-border wrapper and custom button styling.

## Out of scope

- No changes to widget data, sanitization, view loading, or any other Analytics logic.
- Per-chart/per-table empty states already use the canonical system — leaving untouched.
- `AnalyticsEmptyState` deprecated wrapper stays as-is (separately tracked).
