

# Move Status Badge Next to Title + Buttons Below and Left-Aligned

## Changes — `src/components/candidates/CandidateOfferDetails.tsx`

### Current layout (lines 216-302)
Single row: `CardTitle` on left, all buttons + badge on right.

### New layout
1. **Title row**: `CardTitle` + status `Badge` side by side (flex row, gap-2, items-center)
2. **Buttons row below**: All action buttons in a new `div` below the title, left-aligned (`flex items-center gap-2`, no `justify-between`)

```
┌─────────────────────────────────────────┐
│ Offer Details.  [Draft]                 │
│ [Edit] [Request Approval] [Recall] ...  │
└─────────────────────────────────────────┘
```

### Specific edit (lines 216-302)
Replace the `CardHeader` content:
- Line 217-218: Change the title row from `flex items-center justify-between` to just `flex items-center gap-2`, containing `CardTitle` and the `Badge`
- Lines 219-301: Extract all buttons out of that row into a new sibling `div` with `flex items-center gap-2` (no justify-between), placed after the title row but still inside `CardHeader`

No other files changed.

