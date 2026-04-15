

# Show "Internal" Badge for Previously Collected Apollo Candidates

## Problem
Previously collected Apollo candidates have `source: 'apollo'` but `is_preview: false` (set by the cross-reference logic we just added). The `isPdlCandidate` helper treats any `is_preview === false` as PDL, so they get the green "PDL" badge and emerald left border — misleading.

## Fix — 1 file edit

**`src/components/sourcing/SourcingCandidateTable.tsx`**

1. Add a new helper to detect collected Apollo candidates:
   ```ts
   const isCollectedApollo = (c: MatchedCandidate) =>
     c.source === 'apollo' && c.is_preview === false && c.candidate_id
   ```

2. Update `isPdlCandidate` to exclude collected Apollo candidates:
   ```ts
   const isPdlCandidate = (c: MatchedCandidate) =>
     (c.source === 'pdl' || c.is_preview === false) && !isCollectedApollo(c)
   ```

3. Update the source badge block (~line 765) to add an "Internal" badge case:
   ```tsx
   {isCollectedApollo(candidate) ? (
     <Badge variant="pastel-blue" className="text-[10px] px-1.5 py-0 h-4">
       Internal
     </Badge>
   ) : isPdl ? (
     <Badge variant="pastel-green" className="text-[10px] px-1.5 py-0 h-4">
       PDL
     </Badge>
   ) : candidate.source === 'apollo' ? (
     <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
       Apollo
     </Badge>
   ) : null}
   ```

4. Update the left border accent (~line 696) to not apply emerald border for collected Apollo:
   ```tsx
   isPdl && !isActiveRow && !isCollectedApollo(candidate) && "border-l-2 border-l-emerald-400"
   ```

## Scope
- 1 frontend file edit
- 0 backend/migration changes

