# Offer banner — header-black + legible buttons

Three small fixes on the Offer status banner.

## Changes

1. **Match nav header black.** Replace `bg-text-primary` (which renders as #1F1F1F) with the exact navigation header color **#0d0d09 (citron-noir)** so the banner sits visually on the same surface as the top bar. Apply via inline `style={{ backgroundColor: '#0d0d09' }}` to mirror `Header.tsx` and avoid token drift.

2. **Legible "Create offer" button.** The current white pill renders with dark text but contrast is being lost in places. Lock it down: use `variant="primary"` with `onDark` prop so the Button design system swaps the fill to cream (#fffcf9) and forces dark `#0d0d09` text — guaranteed legible against the black banner. Keep the `+` icon and "Create offer" label.

3. **Add "Reactivate" button** to the left of "Create offer" in the Offer banner. Style: `variant="secondary"` + `onDark` (transparent / hairline on dark, white text), same `sm` size. Wires to the existing `handleReactivate` flow that the Rejection banner already uses — moves the candidate back to active status (last pipeline stage).

Layout becomes: `[icon] [eyebrow + title + subtext] · · · [Reactivate] [+ Create offer]`, with `gap-2` between the two right-side buttons.

## Files

- `src/components/candidates/OfferStatusBanner.tsx` — swap bg, add `onReactivate` prop, render both buttons with `onDark`.
- `src/components/candidates/CandidateProfileSheet.tsx` — pass `onReactivate={handleReactivate}` to `<OfferStatusBanner>`.

## Out of scope

- Hired and Rejected banners (their colors and buttons are already legible — green/red with white secondary pills).
- Any status-transition logic; reuses existing handlers.
