## Match `PipelineSectionTabs` to ProfileStageStrip dimensions

**File:** `src/components/jobs/PipelineSectionTabs.tsx` (only)

`ProfileStageStrip` renders taller two-line tiles: `flex-1 min-w-[140px] rounded-xl px-3 py-2.5`, indicator + label on top, meta line below. `PipelineSectionTabs` is currently a single-line 40-px pill row. Replicate the strip's geometry exactly.

### Per-tab tile

- Container: `flex-1 min-w-[140px] rounded-xl px-3 py-2.5 transition-colors` (identical to strip).
- Top row (`flex items-center gap-1.5`):
  - 14-px indicator slot — active: filled white dot inside `bg-white/15` ring (mirrors "current" stage); inactive: section `icon` if present (e.g. `Sparkles`), else `Circle` at `opacity-50`.
  - Label: `font-poppins font-medium text-[12.5px] tracking-[-0.005em] truncate`.
- Bottom row (`mt-1 font-poppins text-[11px] tracking-[-0.005em] truncate`):
  - `{count} candidates` (singular for 1, em-dash when undefined).
  - Color tracks state: active `text-white/70`, inactive `text-text-tertiary/80`.

### State styling (mirrors strip's current/upcoming)

- Active tab → `bg-text-primary text-white`.
- Inactive tab → `border border-dashed border-virgilio-border text-text-tertiary bg-transparent` with `hover:bg-[#FAFAF7] hover:text-text-primary`.

Drop the per-section `active` / `chipInactive` / `chipActive` palettes and the inline count pill — count moves into the meta row. Keep `icon` for Suggested.

### Wrapper

Replace the bordered/shadowed wrapper with the strip's exact wrapper: `flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1`. No outer card.

### Preserved

- Public API: `value`, `onChange`, `counts`, `className`.
- `role="tablist"` / `role="tab"` / `aria-selected` / focus ring.
- No edits to `JobDetail.tsx` or `ProfileStageStrip.tsx`. No business-logic changes.

Result: Suggested / Application Review / Recruiting Process / Job Offers / Hired / Rejected render at the exact same height, padding, radius, and two-line typography as the candidate's stage strip.
