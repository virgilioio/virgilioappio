# Add “ats” to the existing boot animation

## Change
- Keep the current animated Gio dot, pill, and `gio` lettering exactly as they are.
- Add the lowercase word `ats` beside `gio` within the existing animated SVG lockup.
- Let `ats` bloom in as the final beat, about 140ms after the existing `gio` lettering finishes resolving.
- Preserve the current cold-load-only trigger, readiness hold, overlay exit, and reduced-motion behavior.

## Boundaries
- Do not replace the current animation with the PNG.
- Do not change the existing dot-morph geometry, timing, travel, or landing position.
- Do not show this animation during navigation, refetching, or other in-app loading states.

## Verification
- Confirm the final lockup reads `gio ats`, remains centered and sharp, and does not jump during the dot morph.
- Confirm reduced motion immediately shows the complete `gio ats` lockup before the existing fade-out.
- Confirm the build remains clean.

## Technical details
- Update only the existing shared cold-boot splash component.
- Extend its current SVG wordmark rather than loading or clipping `/brand/gio-ats-logo.png`.
