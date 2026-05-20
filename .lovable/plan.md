# Candidate Search — Polish Pass

Two small fixes on top of the new submit-on-Enter search system.

## 1. Ask in plain English: "No matches" after running

### What's happening

After a successful AI search, `handleAiSubmit` does three things:
1. Applies the parsed filters (correct).
2. Sets the search input to `data.query` returned by the edge function (a leftover natural-language phrase, e.g. `"senior product designers in nyc"`).
3. Switches the mode tab to **Everything**.

In Everything mode that leftover string is used as a **substring filter** across name/email/company/skills/etc. Almost nothing matches → the table shows "No matches" even though the filters are perfect.

When the user flips back to Boolean or AI, the substring filter is no longer applied, so the filtered results reappear — giving the (incorrect) impression that something is broken.

### Fix

In `handleAiSubmit`:
- Clear the search input (`setQuery('')`) instead of seeding it with `data.query`.
- Reset `committedQuery` to empty as well.
- Keep the mode switch to **Everything** — it's the right place to land, because the result is now driven purely by chip filters that the user can see and tweak.
- Show a toast like "Filters applied from your prompt" (already in place) and surface the inferred filters via the existing `FilterChipsRow` (already in place).

Optional polish: also surface a small `<InlineLoader label="Thinking…" />` in the search bar's right slot while `aiLoading` is true (already partly there — verify it shows).

## 2. Boolean skeleton feels too quick

Currently `useMinimumDuration(..., 320)` — the skeleton flashes for ~320ms before the (instant, client-side) filtered list appears. For perceived weight, raise the floor to **~700ms** for the Boolean commit path so the "computing" beat lands properly.

AI path stays on the same floor — it has real network latency, so the held duration is already perceptible.

### Implementation

- In `Candidates.tsx`, split the two sources:
  - `const isBooleanRunning = useMinimumDuration(searchRunning, 700)` for the boolean tick.
  - `const isAiRunning = useMinimumDuration(aiLoading, 320)` for AI.
  - `const isSearching = isBooleanRunning || isAiRunning`.

No other behavior changes.

## Files touched

- `src/pages/Candidates.tsx` — both fixes (handleAiSubmit cleanup + split min-duration).

No new components, no style-guide changes, no other call sites affected.
