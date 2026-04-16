

# Sourcing Results: `display_source` Badge Overhaul

## Summary

Adopt the new `display_source` field from the backend across the entire sourcing frontend — badges, filters, preview sheet, source breakdown, and auto-enrichment on candidate creation.

## Changes

### 1. Backend: Add `display_source` to `sourcing-search` response

The edge function currently does NOT emit `display_source`. Add it to the mapping in `sourcing-search/index.ts`:

- Same-tenant match → `display_source: 'internal'`
- Cross-tenant match → `display_source: 'gio'`
- Unmatched Apollo → `display_source: 'apollo'`
- PDL candidates → `display_source: 'pdl'`

Also update `source_breakdown` to include `internal` and `gio` counts.

### 2. Frontend type: Add `display_source` to `MatchedCandidate`

In `SourcingCandidateTable.tsx`, add `display_source?: 'internal' | 'gio' | 'apollo' | 'pdl'` to the interface. Update `sourceBreakdown` interface in both `SourcingCandidateTable.tsx` and `CandidatesTab.tsx` to include `internal` and `gio` counts.

### 3. Replace badge classification helpers

Replace `isCollectedApollo`, `isGioSourced`, `isPdlCandidate`, `isApolloPreview` with a single helper:

```typescript
const getDisplaySource = (c: MatchedCandidate) =>
  c.display_source || // trust backend
  (c.source === 'apollo' && c.is_preview === false && !!c.candidate_id && !c.is_gio_sourced ? 'internal' :
   c.is_gio_sourced ? 'gio' :
   c.source === 'pdl' ? 'pdl' : 'apollo')
```

Badge colors change:
- **Internal** → `bg-green-100 text-green-700` (was pastel-blue)
- **Gio** → `bg-violet-100 text-violet-700` (was pastel-purple, stays brand)
- **Apollo** → `bg-blue-100 text-blue-700` (was secondary gray)
- **PDL** → `bg-teal-100 text-teal-700` (was pastel-green)

Update both desktop table rows and mobile card rows.

### 4. Fix preview sheet: Remove secondary DB lookup

In `ApolloPreviewSheet.tsx`, the `checkIfCollected` effect (lines 260-300) queries the candidates table independently. Remove this lookup. Instead, pass `display_source` and the pre-classified data from the table row into the sheet. When `display_source === 'internal'`, show "Already in your library" using the data already on the row (no extra query needed).

Update `UniversalCandidateProfileSheet` and `ApolloPreviewSheet` to accept and use `display_source`.

### 5. Update filter logic in `SourcingProjectView.tsx`

Replace the `isInternal`/`isGio`/`isExternal` filter classification (lines 173-184) with:

```typescript
const ds = candidate.display_source || /* fallback */
const isInternal = ds === 'internal'
const isGio = ds === 'gio'
const isExternal = ds === 'apollo' || ds === 'pdl'
```

### 6. Auto-enrichment on candidate creation (edge functions)

Add non-blocking `enrich-by-linkedin` calls after candidate INSERT in:

- **`chrome-api-candidates/index.ts`** (after line 317, new candidate path)
- **`public-submit-application/index.ts`** (after line 267, new candidate path)

```typescript
if (newCandidate.id && linkedin_url && !apollo_id) {
  supabase.functions.invoke('enrich-by-linkedin', {
    body: { candidate_ids: [newCandidate.id], skip_credit_check: true, trigger_source: 'on_candidate_create' }
  }).catch(err => console.warn('Auto-enrich failed:', err))
}
```

### 7. Source breakdown summary

Update the source breakdown display (if rendered) to show `"12 Internal · 3 Gio · 5 PDL · 1,847 Apollo"` using the new counts.

## Files Modified

1. `supabase/functions/sourcing-search/index.ts` — Add `display_source` field + updated breakdown
2. `src/components/sourcing/SourcingCandidateTable.tsx` — New type field, simplified classification, new badge colors
3. `src/components/sourcing/SourcingProjectView.tsx` — Filter logic uses `display_source`
4. `src/components/sourcing/CandidatesTab.tsx` — Updated `sourceBreakdown` type
5. `src/components/candidates/ApolloPreviewSheet.tsx` — Remove secondary DB lookup, use passed `display_source`
6. `src/components/candidates/UniversalCandidateProfileSheet.tsx` — Accept and forward `display_source`
7. `supabase/functions/chrome-api-candidates/index.ts` — Auto-enrich after creation
8. `supabase/functions/public-submit-application/index.ts` — Auto-enrich after creation
9. `src/types/sourcing.ts` — No change needed (filter types already support the categories)

