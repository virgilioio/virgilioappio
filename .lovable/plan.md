# Members Stats: Use Pipeline's Real `<MetricStrip>` Component

## Correction
Pipeline's top counters are NOT individual `MetricCard`s. They are one `<MetricStrip>` — a single white card (radius 12, border `#E7E8EE`) divided into cells, each with a 28×28 tinted square icon chip, an 11px muted label on top, and a 19px Poppins bold value below. This matches your screenshot exactly.

## Change
**`src/components/settings/MembersTab.tsx`** — replace the three `MetricCard`s with one `<MetricStrip>` using the exact same component Pipeline imports:

```tsx
import { MetricStrip, type MetricItem } from '@/components/ui/metric-strip'

const metricItems: MetricItem[] = [
  { icon: Users,    tone: 'purple',  label: 'Paid seats',         value: paidCount },
  { icon: UserPlus, tone: 'green',   label: 'Free collaborators', value: freeCount },
  { icon: Archive,  tone: 'neutral', label: 'Deactivated',        value: deactivatedCount },
]

<MetricStrip items={metricItems} />
```

- Remove the `MetricCard` import and the `grid grid-cols-3` wrapper.
- No logic changes; counts stay as-is.

## Verification
Side-by-side compare `/settings?tab=members` strip vs `/pipeline` strip — identical chrome, chips, dividers, typography.