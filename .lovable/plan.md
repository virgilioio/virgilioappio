

# Add Candidate Source Filter (Internal / External)

## What
Add a new collapsible "Candidate Source" section below "Contact Info" in the Result Filters area, with two checkboxes: **Internal** (previously collected candidates already in the database) and **External** (Apollo previews and PDL results from external providers).

## Changes — 2 files

### 1. `src/types/sourcing.ts`
Replace the single-select `source` field with a new multi-select field:
```ts
candidateSource?: ('internal' | 'external')[]
```
Keep the old `source` field for backward compat or remove it if unused elsewhere.

### 2. `src/components/sourcing/FindFilterPanel.tsx`
After the "Contact Info" `CollapsibleSection` (~line 349), add a new collapsible:
- **Label**: "Candidate Source", **Icon**: `Users` (already imported)
- Two checkboxes: "Internal" and "External"
- Toggle logic writes to `resultFilters.candidateSource` array
- Include in the Reset button's default state (`candidateSource: []`)

### 3. `src/components/sourcing/SourcingProjectView.tsx`
Update the filtering logic (~line 143) to handle the new `candidateSource` filter:
- If `candidateSource` includes only `'internal'`: show only candidates where `isCollectedApollo(candidate)` is true
- If `candidateSource` includes only `'external'`: show only candidates where `isCollectedApollo(candidate)` is false
- If both or empty: show all (no filtering)

## Scope
- 3 file edits, ~25 lines net
- 0 backend changes

