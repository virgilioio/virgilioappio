# Boolean search UX + Spinners & Progress system

Two connected changes:
1. Fix the Boolean / "Ask in plain English" UX on Candidates so they behave like *queries*, not live filters.
2. Promote the "Spinners & Progress" mock into a first-class section of the Gio Foundation style guide and ship reusable primitives + apply them across the app.

---

## Part 1 — Boolean & Ask Gio: submit-on-Enter + skeleton

### Behavior

- **Live filter (default plain text):** unchanged — debounced filter as you type.
- **Boolean mode toggle ON:**
  - Typing does NOT filter the list.
  - Validation error chip does NOT appear while typing.
  - **Enter** (or Cmd/Ctrl+Enter) commits the expression → table swaps to skeleton → renders filtered results.
  - **Esc** clears the expression and resets the list.
  - Parse errors only surface after submit, as an inline chip under the field.
  - If results count is 0 → standard `TableEmpty` with "Clear boolean" CTA.
  - When the expression has unsubmitted changes vs. last run, show a faint "Press Enter to run" hint on the right of the field, and dim the run affordance.
- **Ask Gio (NL) mode:**
  - Same submit-on-Enter pattern (already async via `candidates-nl-search`).
  - While the edge function is in-flight → skeleton in table, "Thinking…" pill above.
- **Loading floor:** minimum visible skeleton duration ~280ms so fast results don't flash.

### Files

- `src/pages/Candidates.tsx` — wire `committedBooleanExpr` / `committedNlQuery` state separate from the input value; pass committed values to filtering hooks; gate filter run on submit only.
- `src/hooks/useCandidateBooleanFilter.ts` — accept `committedExpr` instead of live `expr`; expose `isRunning` flag (drives skeleton floor via setTimeout).
- `src/components/candidates/list/CandidatesTable.tsx` — when `isRunning` is true, render `<TableSkeleton rows={8} columns={...} />` inside `<TableBody>` instead of rows.
- Boolean input component (wherever it lives in `src/components/candidates/`) — add Enter/Esc handling, "Press Enter to run" hint, defer error chip to post-submit.

---

## Part 2 — Spinners & Progress: style guide section + primitives

### Decision tree (codified in style guide)

| Wait | Treatment |
|---|---|
| < 1s | nothing |
| 1–10s, known shape | **Skeleton** matching destination |
| 1–10s, unknown shape, in-place | **Spinner** |
| Determinate, > 1s | **Linear progress** (bar) |
| Long, multi-step | **Stepped progress** with labels |
| Indeterminate, multi-second background | **Indeterminate bar** (top of region) |
| Inside a button | **Button `loading`** (width-locked) |

One affordance per region. Never spinner + skeleton together.

### New primitives — `src/components/ui/progress-system/`

```text
progress-system/
  Spinner.tsx           // 12 / 14 / 16 / 20 / 24 px; tone="ink|purple|cream|muted"
  CircularProgress.tsx  // determinate ring, 0–100
  LinearProgress.tsx    // determinate bar, 4h default, tone variants
  IndeterminateBar.tsx  // 2h top-of-region shimmer
  StepProgress.tsx      // labeled steps
  InlineLoader.tsx      // spinner + label ("Loading…", "Sending…")
  Shimmer.tsx           // base shimmer used by all skeletons
  index.ts
```

All built with the tokens from the mock (`--citron-noir`, `--cream`, `--accent-primary` = virgilio-purple, `--hairline`, `--muted`). Single shared `@keyframes gio-spin` and `gio-shimmer` added to `tailwind.config.ts` / `index.css`. Respects `prefers-reduced-motion` (replaces rotation with opacity pulse).

### Existing primitives — align, do not duplicate

- `src/components/ui/skeleton.tsx` — re-implement `Skeleton` base on top of new `Shimmer` for visual consistency; keep API.
- `src/components/ui/table-states.tsx` `TableSkeleton` — adopt shared shimmer; unchanged API.
- `src/components/search/SearchResultsSkeleton.tsx` — same.
- `src/components/ui/button.tsx` — `loading` prop already exists; swap its spinner glyph to the new `<Spinner size={14} tone="…" />` and ensure width-lock holds. Buttons automatically pick the right tone via variant.

### Style guide doc

- Add **§6 Spinners & Progress** to `docs/style-guide.md` with: when to use each, sizes, tones, code snippets, anti-patterns (no spinner inside skeleton, no double indicator, no spinner < 1s).
- Add a memory entry `mem://style/feedback/spinners-and-progress-v1` and reference it in `mem://index.md` Core.

### Rollout — apply across the app

Targeted sweep, no behavior change beyond swapping ad-hoc loaders:

- **Buttons with `loading`**: already correct API-wise — confirms across `SubmitButton`, form submits in Offers, Members invite, Settings save panels (auto via Button).
- **Tables**: replace any remaining ad-hoc `<Loader2 className="animate-spin" />` cells in `src/components/**/*Table.tsx` with `TableSkeleton`.
- **Top of regions doing background refetch** (Pipeline kanban, Candidates list react-query background) → `<IndeterminateBar />` at top of the scroll container.
- **AI surfaces** (Ask Gio, AI fit insights, AI scorecard, AI draft email): replace bespoke "thinking" UI with `<InlineLoader label="Thinking…" tone="purple" />`.
- **Find / Sourcing**: live search uses `<InlineLoader>` in the chip toolbar; result cards keep their existing skeleton (rebased on shared Shimmer).
- **Boolean / Ask Gio on Candidates**: `TableSkeleton` on submit (Part 1).
- **Dashboard widgets**: initial-load skeleton stays; in-widget refresh uses `<IndeterminateBar />` per "Unified loading gates" memory.

Out of scope: redesigning skeleton silhouettes per surface; analytics/charts loaders (separate pass).

---

## Technical notes

- All new primitives are pure presentational React + Tailwind, no new deps.
- Animations defined once in `index.css` (`gio-spin` 0.9s linear infinite, `gio-shimmer` 1.4s ease-in-out infinite) and exposed as Tailwind utilities `animate-gio-spin`, `animate-gio-shimmer`.
- Button `loading` width-lock preserved (measure → set min-width before swap).
- Skeleton floor implemented via `useMinimumDuration(isRunning, 280)` hook in `src/hooks/useMinimumDuration.ts`.
- `prefers-reduced-motion`: spin → 0.7→1 opacity pulse @ 1.2s; shimmer → static muted fill.
- No DB or edge function changes.
