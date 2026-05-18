# Status banners replace the stage bar

When a candidate is in Offer, Hired, or Rejected status, the stage strip is hidden and a redesigned status banner is rendered in its exact slot — matching the strip's height pixel-for-pixel.

## What changes

1. **Swap slot, not stack.** Today the stage strip lives in "Card 2" (the white `section` directly under `ProfileHeroCard`), and the Offer/Hired/Rejection banners render again above the tabs. For non-active statuses we will:
   - Hide `ProfileStageStrip`.
   - Render the matching banner inside the **same Card 2 wrapper** (same outer `section`, same padding, same border/radius/shadow), so its outer height equals the previous stage bar exactly.
   - Remove the duplicate banner block currently sitting above the tab content (no second copy).
   - Active candidates keep the stage strip as-is.

2. **Redesign the three banners** to match the attached mockup (single visual system, only color + copy + action differ):
   - Dark surface (`bg-text-primary text-white`, rounded-2xl, no extra outer card chrome since they sit inside Card 2).
   - Left: 40px rounded icon tile (hourglass for Offer, check for Hired, X for Rejected) on a subtle white/10 background.
   - Eyebrow: `STAGE NAME · Moved here {Xd}` in Poppins 10.5px caps, lilac/purple tint.
   - Title: Poppins 15px semibold (e.g. "Ready to send an offer.", "Candidate hired.", "Candidate rejected.").
   - Subtext: Inter 12.5px muted white/70 (context line — alignment copy / job + date / reason).
   - Right: single white pill action button (`+ Create offer`, `Unhire`, `Reactivate`) — `variant="secondary"`, size `sm`.
   - Layout: `flex items-center justify-between` with `gap-3`, vertically centered so total height ≈ stage strip chip height.

3. **Height parity.** Card 2 padding (`p-5 sm:p-6`) and the inner banner's vertical rhythm are tuned so the rendered card height equals the stage-strip version. No fixed pixel hacks — same wrapper + matched inner content height (icon tile + 2 text lines ≈ chip's title + meta line).

## Files

- `src/components/candidates/CandidateProfileSheet.tsx` — branch Card 2 content on `associationStatus`; remove the second banner block above tabs (lines ~1183-1215).
- `src/components/candidates/OfferStatusBanner.tsx` — redesign per mockup; drop outer card chrome (parent provides it).
- `src/components/candidates/HiredStatusBanner.tsx` — same redesign, hired variant.
- `src/components/candidates/RejectionStatusBanner.tsx` — same redesign, rejected variant (keeps "Reactivate" action; reason/notes shown as subtext, truncated).

## Out of scope

- No changes to status transition logic, hooks, or data fetching.
- Quick Actions card and hero card behavior unchanged.
