

# Fix PDL Badge on Gio Candidate Profiles

## Problem
The `PdlCandidateProfileSheet` hardcodes "PDL · Full Data" badge and "Based on PDL candidate data" subtitle — even when displaying Gio-sourced candidates.

## Fix — 1 file

**`src/components/candidates/PdlCandidateProfileSheet.tsx`**

Two changes based on `candidate.is_gio_sourced`:

1. **Line 91** — Badge: show `"Gio · Enriched"` with `pastel-purple` variant instead of `"PDL · Full Data"` with `pastel-green`
2. **Line 169** — Subtitle: show `"Based on Gio enriched candidate data"` instead of `"Based on PDL candidate data"`

```tsx
// Line 91
<Badge variant={candidate.is_gio_sourced ? "pastel-purple" : "pastel-green"} className="text-xs">
  {candidate.is_gio_sourced ? "Gio · Enriched" : "PDL · Full Data"}
</Badge>

// Line 169
<p className="text-xs text-muted-foreground">
  {candidate.is_gio_sourced ? "Based on Gio enriched candidate data" : "Based on PDL candidate data"}
</p>
```

## Scope
- 2 line changes in 1 file

