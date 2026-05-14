## Wrap PipelineSectionTabs in a card; restore per-section active colors

**File:** `src/components/jobs/PipelineSectionTabs.tsx` only

Match the candidate page exactly: the stage strip there sits inside `bg-white border border-virgilio-border rounded-2xl shadow-sm p-5 sm:p-6` (`CandidateProfileSheet.tsx:1150`). Restore the original per-section colors for the active state.

### 1. Card wrapper

Wrap the tile row in that same card; keep `className` forwarded to the outer `<section>`.

```tsx
<section className={cn('bg-white border border-virgilio-border rounded-2xl shadow-sm p-5 sm:p-6', className)}>
  <div role="tablist" aria-label="Pipeline section" className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
    {/* tiles */}
  </div>
</section>
```

### 2. Restore per-section active palette

Use the original `SECTIONS[].active` tones for the active tile: Suggested `bg-pastel-purple/40`, Application Review `bg-pastel-purple`, Recruiting `bg-pastel-yellow`, Offers `bg-pastel-blue`, Hired `bg-success/20`, Rejected `bg-destructive/15` — all with `text-text-primary`.

Per-tile state classes:

- Active → `cn(s.active, 'font-semibold')`.
- Inactive → unchanged: `border border-dashed border-virgilio-border text-text-tertiary bg-transparent hover:bg-[#FAFAF7] hover:text-text-primary`.

### 3. Indicator + meta colors adapted for pastel active

Swap white-on-dark → dark-on-pastel for active state:

- Active indicator: `bg-text-primary/10` ring with `bg-text-primary` inner dot.
- Active meta line: `text-text-primary/70` (was `text-white/70`).
- Inactive indicator/meta unchanged.

### Preserved

- Tile geometry: `flex-1 min-w-[140px] rounded-xl px-3 py-2.5` two-line layout (12.5 px label + 11 px meta).
- Count formatting `{n} candidate(s)` / `—`.
- Public API (`value`, `onChange`, `counts`, `className`).
- ARIA roles, focus ring, section icons (Sparkles for Suggested) on inactive tiles.
- No edits to `ProfileStageStrip` or `JobDetail`.
