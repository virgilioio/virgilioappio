

# Audit: Bulk Upload Candidates — Critical Bug Found

## Root Cause: Infinite Loop in GlobalBulkUploadWidget

**File:** `src/components/candidates/GlobalBulkUploadWidget.tsx`, lines 19-25

```ts
useEffect(() => {
  if (isUploadActive && files.length > 0 && options && step === "processing") {
    resetUploadState()
    uploadCandidates(files, options)
  }
}, [isUploadActive, files, options, step, resetUploadState, uploadCandidates])
```

`resetUploadState` and `uploadCandidates` are plain functions in `useBulkCandidateUpload` — **not wrapped in `useCallback`**. Every render produces new references, which retriggers this effect, calling `resetUploadState()` (which sets state → re-render), creating an infinite loop. The upload either never starts properly or fires multiple times simultaneously.

## Fix Plan

### 1. `src/hooks/useBulkCandidateUpload.ts` — Memoize functions

Wrap `resetUploadState`, `uploadCandidates`, `updateFileStatus`, `processFile`, `calculateOverallProgress`, and `calculateSummary` with `useCallback` so their references are stable across renders.

Key changes:
- Import `useCallback` alongside `useState, useRef`
- `resetUploadState` → `useCallback(() => { ... }, [])`
- `uploadCandidates` → `useCallback(async (files, options) => { ... }, [deps])` with proper dependency array (the inner functions it calls must also be stable or ref-based)
- Since `processFile` captures many hook values (`parseResumeCoreFields`, `addCandidate`, etc.), store those in refs to avoid bloating the dependency chain

### 2. `src/components/candidates/GlobalBulkUploadWidget.tsx` — Guard against re-triggers

Add a `hasStartedRef` guard to the upload-triggering effect to ensure it only fires once per upload session:

```ts
const hasStartedRef = useRef(false)

useEffect(() => {
  if (isUploadActive && files.length > 0 && options && step === "processing" && !hasStartedRef.current) {
    hasStartedRef.current = true
    resetUploadState()
    uploadCandidates(files, options)
  }
}, [isUploadActive, files, options, step])

// Reset the guard when upload becomes inactive
useEffect(() => {
  if (!isUploadActive) {
    hasStartedRef.current = false
  }
}, [isUploadActive])
```

Also remove `resetUploadState` and `uploadCandidates` from the dependency array since we're using the ref guard.

### 3. Edge function and rest of pipeline

The `parse-resume` edge function, `addCandidate` with `skipRefresh`/`silent`, file upload to storage, enrichment queue, and concurrency control all look correct. The issue is isolated to the trigger loop.

## Summary

| File | Change |
|------|--------|
| `src/hooks/useBulkCandidateUpload.ts` | Wrap `resetUploadState` and `uploadCandidates` in `useCallback` for stable refs |
| `src/components/candidates/GlobalBulkUploadWidget.tsx` | Add `hasStartedRef` guard to prevent re-triggering; remove unstable deps from effect |

