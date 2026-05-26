# Match `LinkedToJobBanner` to the screenshot

I previously shrunk the pipeline strip into thin chips. The screenshot you keep sharing is the **target**, not the current state — so I need to go back to bigger cards and reorder the footer.

## Changes to `src/components/sourcing/LinkedToJobBanner.tsx`

### 1. Header (already matches — keep)
- 28px rounded square green tile with `Link2` icon ✓
- Title `Linked to {jobTitle}` with the job name in `text-virgilio-purple` (currently `text-text-primary` — switch back to purple to match screenshot)
- Sub-line: `{n} collected candidates moved into {stage} · future collects flow there automatically.` (use `·` separator, not period)

### 2. Pipeline strip — revert chips → cards
Replace the small 28h chips with a 4-column grid of **rounded-xl cards**, ~76px tall, matching the screenshot:

```text
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ SOURCED      │ │ APPLIED      │ │ PHONE        │ │ ONSITE       │
│ 24 +2        │ │ 86           │ │ 14           │ │ 4            │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
   (lilac)         (cream)          (cream)         (cream)
```

- Container: `grid grid-cols-4 gap-2 mt-3`
- Each card: `rounded-xl px-3 py-2.5 flex flex-col gap-1`
  - **Default stage:** `bg-[#EDE4FF]` with `text-virgilio-purple` for both label and count
  - **Other stages:** `bg-[#FAFAF7]` with `text-text-secondary` label and `text-text-primary` count
- Label: `text-[10.5px] font-medium uppercase tracking-[0.06em] font-inter`
- Count row: `font-poppins font-semibold text-[22px] tabular-nums leading-none` with inline `+N` rendered as plain bold text next to the number (e.g. `24 +2`), same color as the count, **not** a pill — matches screenshot exactly

### 3. Footer — reorder and restyle
Current order: `Back to Find` (ghost) · `Done` (ghost) · `Open pipeline` (primary, right).
Screenshot order: **`Open pipeline` (primary, LEFT)** · `Back to Find` (secondary outline, middle) · `Done` (ghost, far RIGHT).

- Container: `mt-3 flex items-center gap-2` (no `justify-end`)
- `<Button size="sm" variant="primary" icon={TrendingUp} onClick={...}>Open pipeline</Button>` — uses `TrendingUp` icon (the line-chart icon in the screenshot), not `ArrowRight`
- `<Button size="sm" variant="secondary" icon={ArrowLeft}>Back to Find</Button>`
- `<div className="ml-auto" />` to push Done to the right
- `<Button size="sm" variant="ghost">Done</Button>`

### 4. Container
- Keep `rounded-lg border border-success/40 bg-success/10 px-4 py-3`
- Bump title link tile back to `h-7 w-7` with `Link2` at `h-3.5 w-3.5` to match the proportions in the screenshot

## Out of scope
- No data/behavior changes — same props, same handlers, same dismiss logic.
- Only `LinkedToJobBanner.tsx` is touched.
