

# Add Source Dropdown to Bulk Upload Dialogs

## Context

The approved (not yet implemented) plan creates a `candidate_sources` table and `useCandidateSources` hook. This addendum adds a **required** Source dropdown to both bulk upload dialogs. The CSV import already supports `source` as a mappable column field — no changes needed there.

## Changes

### `src/hooks/useBulkCandidateUpload.ts`
- Add `source?: string` to `BulkUploadOptions` interface (line 14)
- Pass `options.source` into the `candidateData` object in `processFile` (line 136-145)

### `src/components/candidates/MinimizableBulkUploadDialog.tsx`
- Add `source` state (default `""`)
- Import and call `useCandidateSources()` to get source options
- Add a **required** `SearchableSelect` for Source below the Job dropdown (already supports type-to-search)
- Pass `source` into `startUpload` options
- Disable the Upload button when `source` is empty (`disabled={files.length === 0 || !source}`)
- Reset `source` on dialog open

### `src/components/candidates/BulkUploadDialog.tsx`
- Add `source` state (default `undefined`)
- Import and call `useCandidateSources()` to get source options
- Add a **required** `SearchableSelect` for Source in the Options section (replaces plain `Select` pattern for searchability)
- Pass `source` into `uploadCandidates` options
- Disable the Start Upload button when `source` is empty
- Reset `source` on dialog close

### `src/contexts/BulkUploadContext.tsx`
- No changes needed — `BulkUploadOptions` is imported from `useBulkCandidateUpload.ts`, so the `source` field flows through automatically

## Notes
- Both dialogs use `SearchableSelect` which already has built-in type-to-search via `CommandInput`
- The CSV import dialog already has `source` as a mappable column — no changes needed there
- This depends on the `useCandidateSources` hook and `candidate_sources` table from the parent plan being implemented first

| File | Change |
|------|--------|
| `src/hooks/useBulkCandidateUpload.ts` | Add `source` to `BulkUploadOptions`, pass to candidate data |
| `src/components/candidates/MinimizableBulkUploadDialog.tsx` | Add required Source SearchableSelect |
| `src/components/candidates/BulkUploadDialog.tsx` | Add required Source SearchableSelect |

