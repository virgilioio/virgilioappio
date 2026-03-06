

# Redesign Career Summary Card: Replace Metric Cards with a List

## What changes
**File:** `src/components/candidates/IndependentCandidateProfileSheet.tsx` (lines 462–544)

Replace the current layout (title row + badges row + metric cards grid) with a single clean **list layout**:

```
Current Job Title      Ingeniero de Calidad
Standardized Title     Quality Engineer
Seniority              Mid
Functional Area        Engineering
Specialization         Quality Assurance
Years Experience       10
Companies              3
Avg. Tenure            2y
Years Leadership       5
```

### Implementation
- Remove the separate "Title row" (lines 474-489), "Badges row" (lines 492-508), and "Metrics row" grid (lines 511-540)
- Replace with a single `<dl>` or div-based key-value list using consistent `text-sm` styling:
  - Each row: label on the left (muted), value on the right
  - Keep the standardized title `Badge` with sparkle icon inline with the value when it differs from current title
  - Keep seniority `capitalize` formatting
  - Keep avg tenure year/month formatting logic
  - Only render rows where data exists (same null checks as current)
- The card header, accordion behavior, and show condition remain unchanged

