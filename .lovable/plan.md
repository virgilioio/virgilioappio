

# Fix: Support First Name + Last Name Columns in CSV Import

## Problem

The CSV mapper only offers "Full Name" (`candidate_name`). Real-world CSVs commonly have separate "First Name" and "Last Name" columns. Currently, `first name` auto-maps to `candidate_name`, and `last name` has no mapping at all — it gets silently skipped.

## Changes

### 1. Add `first_name` and `last_name` as new CandidateField options (`src/lib/csvParser.ts`)

- Add `'first_name'` and `'last_name'` to the `CandidateField` type
- Add them to `CANDIDATE_FIELD_OPTIONS` with labels "First Name" and "Last Name"
- Add auto-map entries: `first name`, `firstname`, `given name`, `nombre`, `primer nombre` → `first_name`; `last name`, `lastname`, `surname`, `family name`, `apellido`, `apellidos` → `last_name`
- Remove `'first name': 'candidate_name'` from AUTO_MAP (it was wrong — mapping first name only as full name loses the last name)

### 2. Concatenate first + last name during import (`src/hooks/useCSVCandidateImport.ts`)

In the row-mapping logic, after building the candidate object, if `first_name` or `last_name` exist but `candidate_name` doesn't, combine them:

```typescript
if (!candidate.candidate_name && (candidate.first_name || candidate.last_name)) {
  candidate.candidate_name = [candidate.first_name, candidate.last_name]
    .filter(Boolean).join(' ')
}
delete candidate.first_name
delete candidate.last_name
```

This runs before the `.filter(c => c.candidate_name)` check, so rows with first/last name but no full name still pass validation.

### 3. Also include in this round (from the previous approved plan)

While touching these files, also apply the previously approved expansions:
- Add `current_job_title`, `company_current`, `seniority_level`, `years_experience` to mappable fields
- Expand AUTO_MAP with ~20 more resume URL variants (cv, curriculum, etc.) and Spanish equivalents for common fields
- Add substring fallback matching in `autoMapHeaders` for headers containing `resume`, `cv`, `linkedin`, `email`
- Add URL-detection warning in `CSVImportDialog.tsx` for skipped columns containing `http` values
- Handle new fields in the import hook's insert data

| File | Changes |
|---|---|
| `src/lib/csvParser.ts` | Add `first_name`, `last_name`, `current_job_title`, `company_current`, `seniority_level`, `years_experience` to type + options. Expand AUTO_MAP massively. Add substring fallback matching. |
| `src/hooks/useCSVCandidateImport.ts` | Concatenate first+last into candidate_name. Add new fields to insert object. |
| `src/components/candidates/CSVImportDialog.tsx` | Add warning banner when a skipped column contains URL-like values. |

