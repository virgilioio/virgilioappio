# Use canonical EmptyState in Job → Sourcing tab

## Problem

`src/components/jobs/JobSourcingTab.tsx` hand-rolls its "no sourcing project yet" block — a custom rounded card with a grey `Search` icon tile, ad-hoc typography, and a manual CTA. This bypasses the canonical `<EmptyState>` primitive and violates the project Core rule ("Never hand-roll empty blocks").

The "project exists" branch is a linked-project summary card (not an empty state) and stays untouched. The loading branch is a simple skeleton placeholder and also stays as-is (loading ≠ empty per the EmptyState memo).

## Change

Refactor only the "no project" branch of `JobSourcingTab.tsx` to render the canonical primitive.

```tsx
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { Sparkles } from 'lucide-react'

// ...in the no-project branch:
return (
  <div className="p-6">
    <EmptyState
      size="card"
      title="No sourcing project yet"
      body="Start a sourcing project linked to this job — Gio will surface matching candidates and keep them organized in one place."
      primary={
        <EmptyAction
          icon={<Sparkles size={16} strokeWidth={2} />}
          onClick={handleStart}
          loading={creating}
        >
          Start sourcing for this job
        </EmptyAction>
      }
    />
  </div>
)
```

Notes:
- Uses the default Gio mascot illustration (per the canonical empty-state spec for `inline`/`card` contexts).
- Title plain text — the purple period is auto-appended by the primitive.
- CTA preserves the existing `handleStart` / `creating` behavior (calls `ensureProject` then navigates to `/find/:id`).
- If `EmptyAction` does not support `loading`, fall back to disabling it while `creating` is true and keep the label.

## Out of scope

- The linked-project summary card (it's a status card, not empty).
- The loading skeleton (separate concern per the empty-state memo).
- Any other tab or sourcing surface.

## Verification

- Visit a job with no sourcing project → see canonical mascot empty state with the "Start sourcing for this job" CTA.
- Click the CTA → project is created and the view navigates to `/find/:id` (unchanged behavior).
- Visit a job that already has a project → the linked-project card still renders unchanged.
