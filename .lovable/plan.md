

## Fix Currency Selectors in Job Postings Form

### Problem
In `src/components/jobs/postings/PostingSheet.tsx`, the currency dropdowns for both salary and commissions are empty. The file contains comments saying "Currency functionality removed" and the currencies array is hardcoded to an empty array:

```ts
const currencies: any[] = []
```

This means when creating or editing a job posting, no currency options appear in the salary or commissions currency dropdowns.

### Fix
Import and use the existing `CURRENCIES` constant from `src/constants/currencies.ts` (already used by the Job forms). Update the two `<Select>` dropdowns to reference the correct property names (`value` and `label` instead of `code` and `name`).

### Technical Details

| File | Change |
|---|---|
| `src/components/jobs/postings/PostingSheet.tsx` | 1. Add import: `import { CURRENCIES } from '@/constants/currencies'` |
| | 2. Remove line 48-49 (the "removed" comment and empty array) |
| | 3. Line ~208: Change `currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>)` to `CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)` |
| | 4. Line ~256: Same change for the commissions currency dropdown |

No new dependencies needed -- `CURRENCIES` already exists and is used elsewhere in the codebase.

