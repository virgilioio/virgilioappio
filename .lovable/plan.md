

# Fix: Add Country-Level Entries to Location Options

## Problem
The `LOCATION_OPTIONS` array in `src/constants/locations.ts` contains cities and states but has **no country-level entries** at all. The `LocationSelector` component already supports rendering them (it checks for `type: 'country'` and displays "Country" as the subtitle), but the data is missing.

## Fix
Add country entries to `src/constants/locations.ts` at the top of the array (before cities/states) for all countries already represented: United States, Canada, Mexico, and any others present in the file.

Country entries follow the existing pattern:
```typescript
{ value: "US", label: "United States", country: "United States", countryCode: "US", type: "country" },
{ value: "CA", label: "Canada", country: "Canada", countryCode: "CA", type: "country" },
{ value: "MX", label: "Mexico", country: "Mexico", countryCode: "MX", type: "country" },
// + all other countries in the file (Colombia, Brazil, UK, etc.)
```

## Files changed

| File | Change |
|------|--------|
| `src/constants/locations.ts` | Add country-level entries at the top of the array for all represented countries |

