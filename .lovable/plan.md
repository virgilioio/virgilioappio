# ATS logo dot-morph boot splash

## Build
- Replace the current hand-drawn boot wordmark with the supplied `gio-ats-logo.png`, split at the exact `gio` / `ats` clip boundary using instance-unique SVG clip IDs.
- Keep the measured animated dot and pill geometry unchanged and apply the specified dot travel, pill arrival, and staggered wordmark bloom timings.
- Keep the app mounted beneath the cream overlay; hold the completed mark until readiness, then run the specified upward exit and unmount sequence.
- Preserve cold-load-only behavior so navigation, refetching, and short in-app waits never replay the splash.
- For reduced motion, render the complete lockup immediately and use only a brief overlay cross-fade.

## Verification
- Check the cold-load animation and final lockup in the running preview.
- Confirm the logo remains visible on cream, clip IDs are unique, the live app is mounted beneath it, and the current build remains clean.

## Technical details
- Update only the shared boot splash component; reuse the existing readiness latch and existing brand PNG at `/brand/gio-ats-logo.png`.
- Use the exact 342×190 SVG coordinate system and preserve `brightness(0)` throughout the wordmark animation.
