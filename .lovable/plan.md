# Pipeline Overview — canonical empty state

The Pipeline Overview table in `src/components/analytics/PipelineOverviewTable.tsx` still renders a hand‑rolled empty block (a faded `GitBranch` icon plus two `<p>` lines). This violates the "no hand‑rolled empties" rule — every empty surface must use the canonical `<EmptyState>` primitive with one of the `SoftIllustrations` scenes.

## Change

Replace the hand‑rolled block (lines ~26–47) with the canonical primitive, keeping the surrounding `Card` + `CardHeader` chrome intact so the card title ("Pipeline Overview") still anchors the section.

- Use `size="card"` (this lives inside a Card on the analytics page).
- Use `SoftMagnifier` as the illustration — the message is filter‑driven ("No jobs match your current filters"), which is the standard filtered‑empty semantic.
- Title: `No matches` (purple period auto‑appended by the primitive).
- Body: `No jobs match your current filters. Adjust them to see pipeline data.`
- No CTA — filter controls live in the parent toolbar, not in this card.

Remove the now‑unused `GitBranch` import path used only inside the old empty block (the header still imports/uses `GitBranch`, so just drop the duplicated usage inside the empty render).

## Technical details

File: `src/components/analytics/PipelineOverviewTable.tsx`

```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { SoftMagnifier } from '@/components/ui/EmptyIllustrations'

// inside the `if (!isLoading && rows.length === 0)` branch, replace the inner CardContent with:
<CardContent>
  <EmptyState
    size="card"
    illustration={<SoftMagnifier />}
    title="No matches"
    body="No jobs match your current filters. Adjust them to see pipeline data."
  />
</CardContent>
```

No other files change. No business logic, query, or layout changes — purely the empty‑state presentation.
