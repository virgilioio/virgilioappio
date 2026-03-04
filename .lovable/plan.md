

# Fix: Offer Details Display — Ordering and Smart Field Formatting

## Problems

1. **Wrong order** — `Object.entries(fieldValues)` iterates in JS object insertion order, not the form's `display_order`. Fix: iterate over `fields` sorted by `display_order` and look up values from `fieldValues`.

2. **Recruiter shows UUID** — The stored value is a `user_id`. Need to resolve it to a name using `useRecruiterOptions` (already exists).

3. **Employment type shows `full_time`** — Need to map internal values to display labels (e.g., `full_time` → "Full-time").

4. **Work location shows `remote`** — Same issue, map `remote` → "Remote", `hybrid` → "Hybrid", `onsite` → "On-site".

5. **Date timezone bug** — Line 124 still uses `new Date(String(value))` which parses as UTC. Should use `new Date(value + 'T00:00:00')`.

## Changes — `CandidateOfferDetails.tsx`

### Add imports & hooks
- Import `useRecruiterOptions` hook
- Accept `organizationId` prop (already available from parent)
- Call `useRecruiterOptions(organizationId)` to get recruiter name lookup

### Add label maps
```ts
const employmentTypeLabels: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time',
  temporary: 'Temporary', internship: 'Internship'
}
const workLocationLabels: Record<string, string> = {
  remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site'
}
```

### Fix iteration order
Replace `Object.entries(fieldValues).map(...)` with:
```ts
fields
  .sort((a, b) => a.display_order - b.display_order)
  .filter(f => fieldValues[f.field_name] !== undefined)
  .map(field => { ... })
```

### Add formatting cases
- `recruiter` → look up label from `recruiterOptions` by value
- `employment_type` → use `employmentTypeLabels` map
- `work_location` → use `workLocationLabels` map
- `date` → fix timezone: `new Date(value + 'T00:00:00')`

### Update parent components
Pass `organizationId` to `CandidateOfferDetails` from `CandidateProfileSheet.tsx` and `CandidateProfile.tsx`.

## Files
- `src/components/candidates/CandidateOfferDetails.tsx` — main changes
- `src/components/candidates/CandidateProfileSheet.tsx` — pass `organizationId` prop
- `src/pages/CandidateProfile.tsx` — pass `organizationId` prop

