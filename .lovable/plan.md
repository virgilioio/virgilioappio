## Sidebar active state — Opaline White

**Color token to save:** `#fffcf9` "Opaline White" — used as the active highlight on the dark sidebar.

### Changes

1. **`mem://design/color-tokens-opaline-white`** (new memory) — Record `Opaline White #fffcf9` as the sidebar active-item highlight on `#0d0d09`. Update `mem://index.md` to reference it.

2. **`src/components/layout/AppSidebar.tsx`** — Swap the active state styles:
   - Active background: `#fffcf9` (was `bg-virgilio-purple`).
   - Active foreground: `text-black` so both the masked Gilio icon and the Briefcase icon render black (mask inherits `currentColor`, so no second asset needed).
   - Inactive state unchanged (`text-white/70`, hover `bg-white/10`).

No changes needed to the icon asset — the existing CSS-mask renderer already follows `currentColor`, so flipping text color to black on active is sufficient.