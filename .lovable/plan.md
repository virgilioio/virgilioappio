# Candidates page — header + page chrome alignment with Jobs

Purely visual. No data, hook, or routing changes.

## What I see today (vs Jobs / vs the mockup)

- **Candidates wrapper** uses `bg-background` (white) and wraps everything in `h-[100dvh] flex flex-col` with a hard **white header band** (`border-b border-virgilio-border bg-surface-primary px-6 py-5`) holding `<CandidatesHeader>`. Because the page is pure white edge-to-edge, the dark floating sidebar reads as **glued to the page chrome**, not floating.
- **Jobs wrapper** uses `bg-virgilio-cream`, no inner header band, content sits in a `container` with normal padding. The dark floating sidebar pops against the cream margin → it visually floats.
- **Jobs title** is `Jobs.` (with `text-virgilio-purple` period), a neutral `<Badge>` count chip, then a row of tiny colored-dot stats. The CTA cluster sits top-right on the same row.
- **Candidates title** is currently `Candidates` (no purple dot), with a faint inline `1,247` text. KPI chips below are large `h-9` pills — visually heavier than Jobs.
- The mockup confirms: cream page, **no inner band**, `Candidates.` with purple dot, small neutral count chip, KPI row beneath, and a `...` kebab beside the action buttons. The left rail (`CandidatesSearchesRail`) and main table sit as separate panels on cream.

## Changes

### 1. `src/pages/Candidates.tsx` — page chrome
- Swap wrapper from `bg-background` to `bg-virgilio-cream`.
- Drop the inner white header band (`border-b border-virgilio-border bg-surface-primary px-6 py-5`). The header now sits directly on cream with the same outer padding the body uses.
- Keep the rail-plus-main body, but ensure the rail and table cards keep their existing white surface so they read as panels on cream (they already do — just confirm no `bg-background` on the body wrapper).

### 2. `src/components/candidates/list/CandidatesHeader.tsx` — mirror Jobs header
- Title becomes `Candidates` + `<span className="text-virgilio-purple">.</span>` using the same Poppins/`text-[28px] sm:text-[32px]` rhythm as Jobs.
- Replace the plain `1,247` text with a `<Badge tone="neutral" size="sm">` next to the title (Jobs pattern).
- KPI chips: shrink from `h-9` to `h-8`, drop the pill background, and let the active state be the only filled chip (matches mockup density). Keep the same icons/tones.
- Add the `...` overflow kebab next to the primary `+ Add candidate` button (visual only — opens a small `DropdownMenu` reusing existing handlers like Import CSV / Bulk upload as menu items on narrow screens; on wide screens those stay as inline secondary buttons exactly like today).

### 3. Sidebar — confirm only
- `AppSidebar` is already `fixed top-3 left-3 bottom-3 rounded-2xl` — no change needed.
- The "integrated" feeling on Candidates was caused by the white page bg above; once the page turns cream the floating sidebar reads correctly.

## Out of scope
- Restructuring `CandidatesSearchesRail` or the table styling.
- Any change to the global `Header` (top dark nav) or `Layout` wrapper paddings.
- Functionality of the kebab beyond surfacing existing actions.
