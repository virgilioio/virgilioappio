

# Add Company Filter to Candidates "More Filters"

## What changes

Add a "Company" filter to the candidates More Filters sheet, using the `company_current` field already present on candidates. This follows the exact same pattern as existing filters (e.g., City, Specialization).

## Files changed

| File | Change |
|------|--------|
| `src/contexts/CandidateFilterContext.tsx` | Add `companies` to `CandidateFilters` interface, `EMPTY_FILTERS`, `ArrayFilterKey` type, and `activeFilterCount` loop |
| `src/hooks/useCandidateFilterOptions.ts` | Add `companyOptions` using `deriveOptions(candidates, c => c.company_current)` to the returned object and empty state |
| `src/hooks/useCandidateFilteredData.ts` | Add company filter check: `if (filters.companies.length > 0 && (!c.company_current \|\| !filters.companies.includes(c.company_current))) return false` |
| `src/components/candidates/CandidateFiltersPanel.tsx` | (1) Add `companyOptions` to the `filterOptions` interface. (2) Add a `FilterCheckboxGroup` for "Company" in the More Filters sheet. (3) Add `companies` to `activeTags` loop. |

## Implementation notes

- `company_current` is already fetched and available on `IndependentCandidate`
- The company filter goes in the "More Filters" sheet (not as a top-level chip) since it can have many values
- Searchable checkbox group, same as City/Specialization
- No database changes needed

