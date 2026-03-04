

# Make Validation Point Cards Pastel Blue

The project has a well-established `pastel-blue` design token (`bg-pastel-blue`, `text-pastel-blue-foreground`) used throughout for AI-style elements (e.g., `BackgroundEnrichmentBanner`).

## Change — `ScorecardValidationPoints.tsx`

Update the individual validation point card backgrounds:

- **Unresolved cards (current stage)**: Change from `border-primary/30 bg-primary/5` → `border-pastel-blue/40 bg-pastel-blue/20`
- **Unresolved cards (other stages)**: Change from `border-border` → `border-pastel-blue/30 bg-pastel-blue/10`
- **Resolved cards**: Keep muted (`bg-muted/50 border-border`) — these are "done" and should look quieter

This matches the existing AI styling pattern (see `BackgroundEnrichmentBanner` which uses `bg-pastel-blue/20 border-pastel-blue/40`).

