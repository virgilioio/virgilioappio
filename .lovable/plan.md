## Phased Badges & Tags Alignment + Style Guide Update

Same shape as the buttons rollout: phased, additive first, visible flip later. Two deliverables:
- **A. Badge component system** — rewrite `<Badge>` into a compositional `tone × type × size × shape × state` system, add `<CounterBadge>` and a removable-chip API.
- **B. Style guide** — append a "Badges & tags" section to `docs/style-guide.md` and update Core memory.

---

### A. Badges — phased rollout

#### Phase A1 — Tone & anatomy tokens (no visible change)

1. **Add CSS tokens** in `src/index.css` for the two missing tones:
   - `--lilac-bg`, `--lilac-fg` (start from `purple-50` / `purple-700`).
   - `--ink-bg` (citron-noir #0d0d09), `--ink-fg` (opaline-white / cream).
2. **Anatomy tokens**:
   - `--badge-h-xs: 18px`, `--badge-h-sm: 22px`, `--badge-h-md: 26px`, `--badge-h-lg: 30px`
   - `--badge-dot: 7px`
   - `--badge-radius-pill: 9999px`, `--badge-radius-square: 6px`
3. **Tailwind**: expose `h-badge-{xs,sm,md,lg}` and the new `lilac` / `ink` color utilities. The 8 other tones reuse existing `pastel-*`, `success`, `destructive`, `warning`, `info`, `muted` palettes.
4. No component edits yet. Existing `<Badge>` keeps working unchanged.

Risk: zero.

#### Phase A2 — Compositional `<Badge>` rewrite (legacy aliases kept)

Adopt the spec's reference CVA skeleton in `src/components/ui/badge.tsx`. Final API:

```tsx
<Badge
  tone="green"               // green|red|pink|yellow|orange|blue|purple|lilac|neutral|ink
  size="sm"                  // xs|sm|md|lg  — default sm
  shape="pill"               // pill|square — default pill
  dot                        // 7px leading dot (status badges)
  bordered                   // 1px hairline fg/20 (busy surfaces)
  pulse                      // 25% halo around the dot (live signals)
  icon={Sparkles}            // leading icon (icon-prefix badge)
  count={4}                  // trailing fg/13% count chip
  onRemove={() => ...}       // adds × → removable chip
>
  Open
</Badge>
```

Rules baked in:
- **Default text:** `font-inter font-medium leading-none`. Per-size text: `text-[10px|11px|12px|12.5px]`.
- **Pulse:** keyframe `badge-pulse` on a positioned ring; only renders when `dot && pulse`.
- **Inverted ink** = simply `tone="ink"` (citron-noir bg + cream fg).
- **Bordered** uses `border border-current/20` rather than per-tone borders — one rule, ten tones.
- **All 40+ legacy `variant="..."`** props kept as deprecated aliases that internally resolve to `tone + dot + label`. Zero call-site breakage.

#### Phase A3 — New primitives & tone map

1. **`<CounterBadge>`** in `src/components/ui/counter-badge.tsx`:
   - Props: `count`, `max=99` (renders `99+`), `dotOnly`.
   - Defaults to red. Always positioned absolute by parent (icon overlay).
2. **`<OverflowMore>`** small recipe component for the `+N more` cluster pattern (skill chips, filter chips). Thin wrapper, neutral tone, no dot.
3. **`<RemovableChip>`** — alias / wrapper around `<Badge onRemove>` so filter code reads cleanly. Migrate `filter-chip-popover.tsx` and `filter-chip-select.tsx` to use it (no behavior change).
4. **Tone map** `src/lib/badge-tones.ts` — single source of truth, encoded verbatim from the spec:
   ```ts
   export const JOB_STATUS_TONE       = { open:'green', paused:'yellow', draft:'neutral', closed:'red', archived:'neutral' };
   export const CANDIDATE_STAGE_TONE  = { sourced:'neutral', phoneScreen:'blue', takeHome:'blue', onsite:'blue', offer:'orange', hired:'green', rejected:'red' };
   export const ROLE_TONE             = { owner:'ink', admin:'blue', recruiter:'purple', hiringManager:'orange', interviewer:'neutral', sales:'lilac' };
   export const INTEGRATION_TONE      = { connected:'green', actionNeeded:'yellow', beta:'lilac', notConnected:'neutral' };
   export const BILLING_TONE          = { currentPlan:'ink', trial:'lilac', paid:'green', refunded:'neutral', pastDue:'red' };
   export const SCORECARD_TONE        = { strongYes:'green', yes:'green', leanYes:'green', neutral:'neutral', leanNo:'red', strongNo:'red' };
   export const aiFitTone = (score:number) =>
     score >= 85 ? 'green' : score >= 70 ? 'blue' : score >= 50 ? 'yellow' : score >= 30 ? 'orange' : 'red';
   ```

Risk: low. Additive.

#### Phase A4 — Sweep visible surfaces

Replace ad-hoc usage with the new system on the most-seen places:
1. **PageHeader meta row** across modules (status badge + count chip + meta text).
2. **Pipeline / Candidates tables** — status → `dot + tone`; switch to `size="xs"` in dense rows.
3. **Members table** — role badges → tone-mapped, no dots.
4. **Filter bar** — `filter-chip-*` → `<RemovableChip>`. All filter chips share `tone="purple"` so they read as a set.
5. **Tab counters** — `<Badge size="xs" tone="purple|neutral">` next to tab labels.
6. **Notification icons** (header bell, messages) → `<CounterBadge>`.
7. **AI / Suggested / Trending / Beta** → **lilac** + icon prefix (Sparkles, Flame).
8. **Skills cluster** → cap at 3–5 visible badges + `<OverflowMore count={N} />`.

Risk: medium (visible). Preview surface-by-surface.

#### Phase A5 — Cleanup

1. JSDoc-deprecate the 40+ legacy variants.
2. After 1–2 sweep passes, delete unused legacy variants.
3. Audit `enhanced-skill-badge`, `new-badge`, `soon-badge` — fold into the new `<Badge>` if redundant.
4. No data/backend changes anywhere in this plan.

---

### B. Style guide update

Append a **"Badges & tags"** section to `docs/style-guide.md`, mirroring the spec exactly:

1. **Three principles** — color carries meaning / pill default + dot for status / small quiet never bold (11px Inter 500, max 12.5px).
2. **Color system** — 10 tones table with token names + meaning legend (positive / critical / warning / informational / brand-emphasis / default).
3. **Types** — 6 structural variants (status, categorical, count, counter dot, removable chip, icon prefix).
4. **Sizes** — locked at xs 18/10, sm 22/11 (default), md 26/12, lg 30/12.5 with usage notes.
5. **States & modifiers** — Default, Pulse, Bordered, Inverted (ink), Square shape.
6. **By use case** — full tone-mapping table verbatim from the spec.
7. **Anatomy** — annotated spec (dot 7px, label per-size, count chip fg/13%, height per-size, radius 999/6, padding-x per-size, gap 6).
8. **In context** — recipes: PageHeader meta row, dense table row, tab counter, filter bar, notification stack, skills overflow.
9. **Do & Don't** — the 4 pairs: dot/no-dot consistency, one-meaning-per-color, three-is-the-limit (overflow chip), size matches row density.

Update **Core memory** (`mem://index.md`):
- Add a **Badges** Core line referencing `docs/style-guide.md` and summarizing tones + default size.
- Mark `mem://style/ui/global-badge-standardization` as superseded (the new style guide is the source of truth).

---

### Rollout order
1. **B (style guide section)** + **A1 (tokens)** — safe, ship together.
2. **A2 (compositional Badge rewrite, legacy aliases kept)** — additive, ship next.
3. **A3 (CounterBadge, OverflowMore, RemovableChip, tone map)** — additive.
4. **A4 (sweep visible surfaces)** — visible, gate behind preview review per surface.
5. **A5 (cleanup, deprecate legacy)** — final polish.

### Out of scope
- No backend or data model changes.
- No icon system changes.
- No color palette additions beyond `lilac` and `ink`.
