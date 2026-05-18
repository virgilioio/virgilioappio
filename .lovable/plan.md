# Status banners replace the stage bar

When a candidate is in Offer, Hired, or Rejected status, the stage strip is hidden and a redesigned status banner is rendered in its exact slot — matching the strip's height pixel-for-pixel.

## What changes

1. **Swap slot, not stack.** Today the stage strip lives in "Card 2" (the white `section` directly under `ProfileHeroCard`), and the Offer/Hired/Rejection banners render again above the tabs. For non-active statuses we will:
   - Hide `ProfileStageStrip`.
   - Render the matching banner inside the **same Card 2 wrapper** (same outer `section`, same padding, same border/radius/shadow), so its outer height equals the previous stage bar exactly.
   - Remove the duplicate banner block currently sitting above the tab content (no second copy).
   - Active candidates keep the stage strip as-is.

2. **Redesign the three banners** to match the attached mockup (one layout, per-status color):
   - **Offer**: dark surface `bg-text-primary text-white` (as mockup).
   - **Hired**: green surface (keep current `hsl(152,57%,28%)`), white text.
   - **Rejected**: red surface (current destructive tone), white text.
   - All three: rounded-2xl, no extra outer card chrome (parent Card 2 provides it).
   - Left: 40px rounded icon tile on white/10 — hourglass (Offer), check (Hired), X (Rejected).
   - Eyebrow: `STAGE NAME · Moved here {Xd}` in Poppins 10.5px caps, tinted (lilac on dark, white/70 on green/red).
   - Title: Poppins 15px semibold ("Ready to send an offer.", "Candidate hired.", "Candidate rejected.").
   - Subtext: Inter 12.5px white/70 (alignment copy / job + date / reason).
   - Right: white pill action button (`+ Create offer`, `Unhire`, `Reactivate`) — `variant="secondary"` size `sm`.
   - Layout: `flex items-center justify-between gap-3`, vertically centered, total height matches the stage strip.

3. **Height parity.** Card 2 padding (`p-5 sm:p-6`) and the inner banner's vertical rhythm are tuned so the rendered card height equals the stage-strip version. No fixed pixel hacks — same wrapper + matched inner content height (icon tile + 2 text lines ≈ chip's title + meta line).

## Files

- `src/components/candidates/CandidateProfileSheet.tsx` — branch Card 2 content on `associationStatus`; remove the second banner block above tabs (lines ~1183-1215).
- `src/components/candidates/OfferStatusBanner.tsx` — redesign per mockup; drop outer card chrome (parent provides it).
- `src/components/candidates/HiredStatusBanner.tsx` — same redesign, hired variant.
- `src/components/candidates/RejectionStatusBanner.tsx` — same redesign, rejected variant (keeps "Reactivate" action; reason/notes shown as subtext, truncated).

## Out of scope

- No changes to status transition logic, hooks, or data fetching.
- Quick Actions card and hero card behavior unchanged.
