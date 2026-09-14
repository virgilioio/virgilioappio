# Use the Gio settings glyph in ATS

## Scope
- Add the exact supplied 48×48 two-colour `SettingsGlyph` to the shared brand-icon area without changing its geometry.
- Replace only icons that navigate to the main Settings destination: desktop rail, account menus, mobile account menu, and any direct setup CTA.
- Keep configuration, template, display, row-action, and other verb-style cogs unchanged.

## States
- Desktop rail: use ink plus lilac only while Settings is active; use one uniform cream tone while inactive and on hover.
- Light menus and direct Settings links: use one uniform muted tone, with no lilac signal.
- Preserve every existing button box, label, tooltip, spacing, and accessible name.

## Shared source
- Use the same shared glyph component consumed by the ATS navigation surfaces.
- The related Gio Sales implementation is not available as a separately editable project in this workspace, so this change will establish the canonical shared source in the unified Gio codebase rather than duplicate the SVG.

## Verification
- Search again for generic cog icons attached to `/settings` destinations.
- Check the current build signal and visually verify the public portions available without managed authentication.
