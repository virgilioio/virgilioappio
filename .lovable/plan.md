## Phased Buttons Alignment + Unified Style Guide

Two parallel deliverables:
- **A. Buttons** — bring the `Button` component into Gio Foundation v1.0 spec.
- **B. Style guide** — collapse old typography + new buttons into a single living `docs/style-guide.md`. Drop legacy guideline files.

---

### A. Buttons — phased rollout

#### Phase A1 — Foundation tokens (no visible change)

Goal: prepare the design system without breaking existing UI.

1. **Update CSS button-height tokens** in `src/index.css`:
   - `--button-height-xs: 24px`
   - `--button-height-sm: 28px` (was 32)
   - `--button-height-default: 34px` (was 36)
   - `--button-height-lg: 40px` (unchanged)
   - `--button-height-xl: 48px`
2. **Add Tailwind `height` tokens**: `button-xs`, `button-xl` in `tailwind.config.ts`.
3. **No component file changes yet** — defaults in `Button` still resolve to old sizes via existing variant classes; Phase A2 wires them up.

Risk: zero. Tokens are additive; existing classes keep working.

#### Phase A2 — `Button` component rewrite (additive variants, opt-in default switch)

Goal: implement every spec variant + size + state. Keep `default` mapped to old purple briefly to avoid an app-wide flash; ship a feature-flagged `primary` variant first.

1. **Add new variants** in `src/components/ui/button.tsx`:
   - `primary` — black fill, white text (will become the new default in Phase A3).
   - `purple` — alias of today's `virgilio` (brand purple). Mark `virgilio` deprecated.
   - `danger` — outline + red text/border (replaces ad-hoc destructive outlines).
   - `dangerSolid` — alias of today's `destructive` for the spec's "danger solid".
   - `primaryOnDark`, `secondaryOnDark`, `ghostOnDark` — for top-bar usage.
2. **Add new sizes**: `xs` (24px), `xl` (48px). Adjust `sm` → 28px and `default` → 34px.
3. **Tone down motion** across all variants per spec ("barely a posture"):
   - Remove `hover:-translate-y-0.5`, `hover:scale-105`, `active:scale-95`.
   - Hover = bg-darken only.
   - Active = `active:translate-y-[0.5px]` + `active:shadow-inner`.
4. **Focus ring** opacity → 35% (`focus-visible:ring-virgilio-purple/35`).
5. **Loading state** — lock width: when `loading`, render with `style={{ width: measuredWidth }}` or simpler `min-w-[<computed>]`. Use `useRef` + `useLayoutEffect` to capture initial width on first mount.
6. Keep all existing variants (`default`, `outline`, `secondary`, `ghost`, `success`, `warning`, `info`, `link`, `virgilio`, `destructive`) working as aliases so no consumer breaks.

Risk: low. Existing call-sites keep their look until Phase A3.

#### Phase A3 — Switch defaults + chrome adoption (visible change)

Goal: align the most-seen surfaces with the spec.

1. **Flip `default` variant** to point at the new `primary` (black). This is the biggest user-visible change — every unspecified `<Button>` becomes black.
2. **Sweep top-bar buttons** (header `Create`, search trigger, nav toggles) to use `primaryOnDark` / `secondaryOnDark` / `ghostOnDark`.
3. **Sweep destructive flows** (Reject candidate, Delete deal, Archive job) to use `danger` (outline) for the trigger and `dangerSolid` for the confirm.
4. **Brand-emphasis buttons** (Add to pipeline, Generate with Gio, Send offer) → explicit `variant="purple"`.
5. **PageHeader actions** → ensure they use `size="md"` (the new default).

Risk: medium. Visible change. Preview on Pipeline / CRM / Settings before merging.

#### Phase A4 — Specialty patterns + cleanup

1. Build / formalize `<SplitButton>` (default action + dropdown chevron).
2. Document `<SegmentedControl>` and the `aria-pressed` toggle button pattern.
3. Remove the deprecated `virgilio` variant (after sweeping all call sites to `purple`).
4. Add an ESLint note discouraging raw `className` font-overrides on `<Button>`.

---

### B. Unified Style Guide

Replace `docs/typography.md` with a single `docs/style-guide.md` that contains both Typography (already shipped Phase 1+2) and Buttons (Gio v1.0). Same structure as the screenshots.

#### Tasks

1. **Create `docs/style-guide.md`** with sections:
   - Foundation principles (the 3 rules at top of each guideline page).
   - Typography (full content of current `docs/typography.md`).
   - Buttons (variants, sizes, states, shapes & content, on-dark, specialty patterns) — mirroring the Buttons screenshot.
2. **Delete `docs/typography.md`** (now consolidated).
3. **Update Core memory** (`mem://index.md`):
   - Replace the Typography Core line and add a Buttons Core line, both pointing to `docs/style-guide.md`.
4. **Drop / archive obsolete style memory entries** that the new guide supersedes:
   - `mem://style/typography/high-density-scaling` → mark superseded by style guide.
   - `mem://style/forms/primary-submit-and-datepicker` → keep (forms-specific rule, still valid).
   - Other `mem://style/...` entries: leave as-is unless they conflict.

---

### Rollout order
1. **B (style guide)** + **A1 (tokens)** — both safe, ship together.
2. **A2 (component variants)** — additive, ship next.
3. **A3 (default flip + chrome sweep)** — gate behind a preview review.
4. **A4 (specialty + cleanup)** — final polish.

### Out of scope
- No data model / backend changes.
- No icon system changes.
- No color palette changes (re-uses existing tokens like `virgilio-purple`, `success`, `destructive`, `foreground`, `background`).
