# Candidate profile — respect floating chrome (header + sidebar)

## Problem

The candidate profile is rendered as `fixed inset-0 z-40` (CandidateProfileSheet.tsx line 1058). The app chrome is floating and sits on top:

- Sidebar: `fixed top-3 left-3 bottom-3 w-16` (z-60) → occupies left 0–76px
- Header: `fixed top-3 right-3 left-[5.5rem] h-12` (z-50) → occupies top 0–60px

Because the profile starts at `inset-0`, its top-left corner ends up underneath both the header and the side rail, hiding the back button, breadcrumbs, and part of the hero card.

## Fix

**File:** `src/components/candidates/CandidateProfileSheet.tsx`

Replace the outer wrapper:

```tsx
<div className="fixed inset-0 z-40 bg-background overflow-hidden">
```

with insets that clear the floating chrome and match its 12px gutter:

```tsx
<div className="fixed top-[4.5rem] left-3 right-3 bottom-3 sm:left-[5.5rem] z-40 bg-background overflow-hidden rounded-2xl ring-1 ring-virgilio-border/60 shadow-calendly">
```

- `top-[4.5rem]` (72px) clears the floating header (`top-3` + `h-12` = 60px) with a 12px gap.
- `sm:left-[5.5rem]` (88px) clears the floating sidebar (`left-3` + `w-16` = 76px) with a 12px gap. On `<sm` the sidebar is hidden, so `left-3` is enough.
- `right-3 bottom-3` mirror the chrome gutters.
- `rounded-2xl` + subtle ring/shadow match the floating-card aesthetic of header & sidebar so the profile reads as a sibling panel, not a full-bleed overlay.

The inner `flex h-full w-full` and all scroll containers below already use `h-full`, so the resized wrapper cascades correctly.

## Out of scope

- No changes to ProfileTopBar, hero card, tabs, action bar, or quick actions.
- No changes to z-index (z-40 stays below the chrome).
- No changes to header/sidebar dimensions.

## Files touched

- `src/components/candidates/CandidateProfileSheet.tsx` (single wrapper className change)
