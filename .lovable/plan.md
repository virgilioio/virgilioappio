## Problem
The avatar dropdown's "Members & invites" row links to `/members`, which is a standalone page (mounted in `App.tsx` as `<Route path="/members" element={<Members />} />`). That page renders members management outside the Settings shell, so the Settings side menu is missing.

The Settings page (`src/pages/Settings.tsx`) already handles a `members` tab that renders `<MembersTab />` inside the standard `SettingsSidebar` + content layout — reachable via `/settings?tab=members`.

## Fix
Single-line change in `src/components/layout/AccountMenu.tsx`:

- Update the "Members & invites" `Row` `to` prop from `"/members"` to `"/settings?tab=members"`.

That routes the user into Settings with the side menu visible and the Members tab preselected, matching every other entry in the dropdown (Profile, Availability, Settings all use `/settings?tab=…`).

## Out of scope
- No changes to `App.tsx`, the `/members` route, or the `Members` page itself (kept as-is so any other deep link still works).
- No changes to `MembersTab` logic, permissions, or data.
- No visual/style changes.