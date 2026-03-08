

# Add Salary Expectations to Candidate Details Card

## What
Display the candidate's salary expectation (amount, currency, period) in the "Candidate Details" card on the Overview tab, right after the Location row. Only shown when `salary_amount` exists.

## Changes

### 1. `src/components/candidates/CandidateProfileSheet.tsx`
After the Location block (line ~1441), before `</CardContent>`, add a salary row:
- DollarSign icon + formatted string like "USD 120,000 / annually"
- Only rendered when `candidate?.salary_amount` is truthy
- Uses existing `DollarSign` import from lucide-react

### 2. `src/components/candidates/IndependentCandidateProfileSheet.tsx`
Same addition after the Location block (line ~651), before `</CardContent>`:
- Same pattern and formatting
- Import `DollarSign` from lucide-react

### Format
```
💲 USD 120,000 / annually
```
Rendered as: `{currency} {amount.toLocaleString()} / {period}` with sensible defaults (USD, annually).

Two files edited, no new files.

