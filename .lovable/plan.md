## Goal
Make the Members section's top stat row use the exact same component as ATS > Pipeline so the two surfaces are visually identical.

## Component to use
`<MetricCard>` from `src/components/ui/metric-card.tsx`, default variant — the same one wrapped by `PipelineMetricCard`. Key style traits (already baked into the component, no overrides):
- `rounded-2xl border-border/60 shadow-md` card, `p-4`
- Left **circular** icon badge: `w-12 h-12 rounded-full bg-background shadow-md border border-border/50`, icon `h-5 w-5`
- Title: `text-xs font-poppins font-medium text-muted-foreground`
- Value: `text-2xl font-poppins font-bold`

## Changes (single file: `src/components/settings/MembersTab.tsx`)
1. Remove the current single segmented stat card (with tinted square tiles) added in the last iteration.
2. Replace with a `grid grid-cols-1 sm:grid-cols-3 gap-3` row of three `<MetricCard>` instances:
   - **Total members** — icon `Users`, value = total count
   - **Active members** — icon `UserCheck`, value = active count, `iconColor="text-virgilio-success"`
   - **Billable seats** — icon `CreditCard` (or `Coins`), value = billable count, `iconColor="text-virgilio-purple"`
3. Drop the now-unused `Lock` import path adjustments only if they're truly unused; keep the footer line ("Billing & invoices are visible to workspace owners.") unchanged.
4. No other files touched. No business-logic changes — `useRecruiterUserIds` and `isBillableMember` stay as-is.

## Verification
- Visually compare `/settings?tab=members` stat row with `/pipeline` stat row — chrome (radius, shadow, circular icon badge, typography) must match 1:1.
- TypeScript build clean.
