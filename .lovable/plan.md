

# Fix: Pipeline Status and Candidate Status filters produce empty results

## Root cause

A case mismatch between filter option values and the raw data being filtered:

1. **Pipeline status options** are generated with `capitalizeStatus()` → values like `"Active"`, `"Rejected"`, `"Hired"`
2. **`applyFilters`** compares these capitalized values against raw `a.status` from the DB (lowercase: `"active"`, `"rejected"`, `"hired"`)
3. `"Active" !== "active"` → no candidates match → empty charts

Same issue for **candidate status**: options are capitalized (`"Active"`, `"New"`) but compared against raw `c.status`.

## Fix

**File: `src/hooks/useTalentIntelligenceFilterOptions.ts`**

Stop capitalizing the `value` field for pipeline status and candidate status options. Use the raw DB value as `value` (for filtering) and the capitalized string only as `label` (for display).

- **Line 79** (candidate status): Change `deriveOptions` call so the value is the raw status, not capitalized. Since `deriveOptions` uses the return of `keyFn` as both value and label, we need a small change — either use raw value in the options map, or create a separate derivation.
- **Lines 82-92** (pipeline status): Use raw `s` as the map key (value), store capitalized as label only.

**Specific changes:**

1. Pipeline status options (lines 82-92): Use raw status as value, capitalized as label:
```typescript
const pipelineStatusMap = new Map<string, { label: string; count: number }>()
for (const a of associations) {
  const s = a.status?.trim()
  if (s) {
    const existing = pipelineStatusMap.get(s)
    if (existing) existing.count++
    else pipelineStatusMap.set(s, { label: capitalizeStatus(s), count: 1 })
  }
}
const pipelineStatusOptions = Array.from(pipelineStatusMap.entries())
  .sort((a, b) => b[1].count - a[1].count)
  .map(([value, { label, count }]) => ({ value, label, count }))
```

2. Candidate status options (line 79): Same pattern — raw value for filtering, capitalized for display. Replace the `deriveOptions` call with a custom derivation that separates value from label.

