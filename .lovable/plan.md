## Goal

Split the current Settings page into two entry points in the left sidebar:

- **Avatar (bottom)** → `/settings?tab=profile` (My Profile)
- **Cog icon (above avatar)** → `/settings` (everything else)

No functional changes to any settings tab — only navigation/entry reorganization.

## Changes

### 1. `src/components/layout/AppSidebar.tsx`

Add a bottom section to the existing fixed sidebar, pushed down with `mt-auto`:

- **Cog button** — inline SVG (Lucide `Settings` style, `currentColor`) following the chrome-icon standard. Links to `/settings`. Active when `pathname === '/settings'` and tab is not `profile`.
- **Avatar button** — circular `Avatar` (existing shadcn component) showing the user's `avatar_url` from `useUserProfile`, fallback to initials. Links to `/settings?tab=profile`. Active when on `/settings?tab=profile`. Same 44×44 hit area, rounded-full, with the same active ring treatment as other items (Opaline White ring when active).

Extend `AppSection` type with `'settings'` and `'my-profile'`. Update `getActiveSection` to read the URL (including `?tab=profile`) so the right item highlights.

### 2. `src/components/settings/SettingsSidebar.tsx`

Remove the `profile` ("My Profile") nav item from `navItems` — it's no longer reachable from the inner Settings sidebar (it has its own avatar entry point now). The `ProfileTab` component and its `<TabsContent value="profile">` in `Settings.tsx` stay untouched so direct URL access still works.

### 3. `src/pages/Settings.tsx`

Change the default tab when no `?tab=` is provided: instead of falling back to `'profile'`, fall back to the first available non-profile tab (e.g., `'organization'` for admins, `'integrations'` for members, etc.). This way the cog opens "Settings" proper, and the avatar (which explicitly sets `?tab=profile`) opens My Profile.

No other files change. No routes added — both entry points reuse `/settings`.

## Out of scope

- Any change to ProfileTab content or other settings tabs
- Permissions logic
- Mobile settings header (already has its own back button)
- Renaming routes or adding `/profile`
