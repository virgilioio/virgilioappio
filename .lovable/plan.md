

# Remove Redundant Metric Cards from Job Detail Header

## Change

**`src/pages/JobDetail.tsx`** (lines 803-808)

Remove the `metrics` prop from the `PageHeader` component so the four KPI cards (Total Candidates, Active Candidates, Hired Candidates, Rejected Candidates) no longer render in the top-right corner of the job detail page.

```tsx
// Before
<PageHeader 
  title={job.title} 
  compact
  metrics={[
    { label: 'Total Candidates', value: totalCandidates },
    { label: 'Active Candidates', value: activeCount },
    { label: 'Hired Candidates', value: hiredCount },
    { label: 'Rejected Candidates', value: rejectedCount }
  ]}
/>

// After
<PageHeader title={job.title} compact />
```

## Files

| File | Change |
|------|--------|
| `src/pages/JobDetail.tsx` | Remove `metrics` prop from `PageHeader` (~line 803-808) |

