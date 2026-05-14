# Fix candidate profile page chrome + black-on-black button text

## Issue 1 — "Advance to …" still has black text on black

The `primary` variant in `src/components/ui/button.tsx` already sets `text-[#fffcf9]` / `[&_svg]:text-[#fffcf9]`. But the buttons appear with dark text inside both `ProfileActionBar` and `ProfileQuickActionsCard`. Something in the cascade (parent `<Card>`, `text-card-foreground`, or arbitrary surface override) is winning at runtime.

**Fix:** Promote the cream foreground in the `primary` variant to `!important` so it always wins, regardless of what wraps the button.

`src/components/ui/button.tsx` — replace the `primary` line:

```tsx
primary:
  "bg-[#0d0d09] !text-[#fffcf9] [&_svg]:!text-[#fffcf9] shadow-[var(--shadow-button)] hover:bg-[#1a1a14] active:bg-[#000000] active:shadow-inner",
```

Do the same defensive bump for `purple` (white-on-purple), `dangerSolid`, `success`, and the legacy `default`, `destructive`, `virgilio` aliases — they all set explicit white/contrast foregrounds that must beat any wrapper color. This is a one-line treatment per variant and preserves all other behavior.

## Issue 2 — Profile page is wrapped in a giant card

The `asPage` wrapper currently renders:

```tsx
"h-[calc(100dvh-4rem-0.75rem)] mb-3 bg-background overflow-hidden rounded-2xl ring-1 ring-virgilio-border/60 shadow-calendly"
```

That single rounded ring + shadow is what the user sees as "the whole page wrapped in a huge card with a header." The mockup shows "Back to job / Jobs › Senior Product Designer › Candidates / 7 of 18 ‹ ›" floating directly on the page background, with the candidate hero card as a separate, distinct card below.

### Fix in `CandidateProfileSheet.tsx`

**1. Outer wrapper (line ~1058–1062)** — in `asPage` mode, strip all card chrome and let it flow:

```tsx
<div className={cn(
  asPage
    ? "min-h-[calc(100dvh-4rem)] bg-background"
    : "fixed top-[4.5rem] left-3 right-3 bottom-3 sm:left-[5.5rem] z-40 bg-background overflow-hidden rounded-2xl ring-1 ring-virgilio-border/60 shadow-calendly"
)}>
```

No `rounded-2xl`, no `ring-1`, no `shadow-calendly`, no `overflow-hidden`. Page scrolls naturally inside Layout's `<main>`.

**2. Inner flex (line ~1063)** — in `asPage` mode, drop `h-full` (no fixed-height parent anymore):

```tsx
<div className={cn(asPage ? "flex w-full" : "flex h-full w-full")}>
```

**3. ProfileTopBar wrapper (line ~1083)** — currently `border-b border-virgilio-border bg-white/60`. The mockup shows this strip transparent and borderless; the only chrome below it is the hero card itself. In `asPage` mode use bare padding:

```tsx
<div className={cn(asPage ? "" : "border-b border-virgilio-border bg-white/60")}>
  <ProfileTopBar … />
</div>
```

**4. Main scroll column (line ~1156)** — `<div className="flex-1 overflow-y-auto">`. In `asPage` mode the page itself scrolls, so drop the inner scroll:

```tsx
<div className={cn("flex-1", asPage ? "" : "overflow-y-auto")}>
```

Same treatment for the loading skeleton container at line ~1078 (`flex-1 overflow-y-auto p-6` → `flex-1 p-6` when `asPage`).

That's it — five conditional classNames inside one component. No new components, no design changes to hero card, tabs, action bar, quick actions, or application card.

## Out of scope

- Overlay mode (Pipeline / Candidates list / Apollo previews) is unchanged.
- No backend / RLS work.
- No tab/header/sidebar redesign.

## Files touched

- `src/components/ui/button.tsx` — `!important` foregrounds on solid-fill variants.
- `src/components/candidates/CandidateProfileSheet.tsx` — strip card chrome + internal scroll in `asPage` mode; ProfileTopBar strip transparent on the page.
