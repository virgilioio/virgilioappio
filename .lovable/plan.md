## Issue

Home and avatar look balanced. The ATS glyph and the Cog glyph both render at `h-6 w-6`, but the cog's outline extends to the edges of its 24×24 viewBox while the ATS shapes only fill ~70% of theirs. Result: the cog reads visually larger and heavier than ATS.

## Fix

Optical normalization in `src/components/layout/AppSidebar.tsx` only — shrink the cog's render size so its bounding glyph matches ATS:

- Cog `<CogIcon className="h-5 w-5" />` (down from `h-6 w-6`)
- ATS keeps `h-6 w-6`
- Home and avatar unchanged

Also reduce cog `strokeWidth` from `2` to `1.75` so its weight matches the filled ATS shapes at the new size.

## Out of scope

- Hit area (stays 44×44 for all)
- Avatar size, home icon size
- Active/hover styling
- Any other sidebar icons
