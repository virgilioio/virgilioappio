# Share with client dropdown

## Build
- Replace the fixed body portal with one absolutely positioned 340px menu inside the existing trigger wrapper, at `top: 36`, `right: 0`, and `z-index: 80`.
- Let the hero action row wrap and show overflow so the anchored menu can extend over the dossier card without clipping.
- Match the internal-link item, public-dossier section, live URL reveal, rejected notice, error, and permanent footer to the supplied spacing, typography, colors, copy, and icon states.
- Reuse the shared export-dialog switch, styled to the specified 38×22 track and 16px thumb, while preserving rejected and read-only disabled behavior.
- Keep outside-mousedown and Escape closing, focus restoration, inline 1.6-second copy confirmation, clipboard fallback, and the existing real share data/actions.

## Validation
- Check live, off, and rejected rendering in source behavior, confirm the preview builds, then open the menu in the browser to verify it appears above the card and remains usable.
