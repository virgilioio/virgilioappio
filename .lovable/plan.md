## Floating dark top bar — symmetric with sidebar

Mirror the sidebar's floating treatment in the top navigation so the two form a single, calm app shell — same surface (`#0d0d09`), same `rounded-2xl`, same 12px gutter from the viewport edge, same soft elevation.

### Aesthetics — quick take

The pairing reads premium: two dark slabs floating on the light canvas frame the workspace like a picture mat. It also clarifies hierarchy — chrome is dark, content is light, no ambiguity. Two things to watch:

1. **Interior controls go dark-mode.** Today the header hosts the global search, create button, sourcing credit chip, notifications, workspace switcher, and avatar. They were styled for a light header. On `#0d0d09` they will look pale and washed out. I'll do a light pass so they read correctly on dark (borders/icons to `white/70`, hovers to `white/10`, dropdowns keep their existing light surface so menus stay readable).
2. **Active nav pill should match the sidebar's active state** — `#fffcf9` background, black text — so the symmetry holds across both bars.

### Changes

1. **`src/components/layout/Header.tsx`** — Convert `<header>` from a full-width bordered bar into a floating slab:
   - Position: `fixed top-3 right-3 left-[4.75rem]` (starts where sidebar ends), `h-12`, `rounded-2xl`, `shadow-calendly`, `ring-1 ring-black/40`.
   - Background: solid `#0d0d09` (drop the translucent/blur — it doesn't read well over varied content on a dark slab).
   - Inner padding tightened to fit the 48px height.
   - Nav link pill: active = `bg-[#fffcf9] text-black`; inactive = `text-white/70 hover:bg-white/10 hover:text-white`. Remove the underline `::after`.
   - Workspace switcher button + avatar trigger restyled for dark (transparent bg, `border-white/15`, `text-white`).
   - Search/create/credits/notifications: add a `dark` styling pass (icon color `text-white/80`, hover `bg-white/10`).

2. **`src/components/layout/Layout.tsx`** — Adjust the main area to clear the floating header and the right-edge gutter:
   - Wrapper gets `sm:pl-[4.75rem] sm:pr-3`.
   - Main top padding from `sm:pt-14` → `sm:pt-[4rem]` (top-3 + 48px header + 4px breathing room), bottom unchanged.

3. **No changes** to `AppSidebar.tsx`, `PageHeader.tsx`, or routing.

### Out of scope

- Mobile bottom nav and mobile header (sidebar/header are already hidden under `sm:`).
- Dropdown menu *content* surfaces (they remain light for readability) — only the *triggers* go dark.