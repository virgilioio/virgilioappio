

# Allow Members to Access Integrations in Settings

## Problem

The "Workspace" section in the settings sidebar is gated to platform admins and workspace owners only (line 67). Regular members (with `isMember` role) cannot see Integrations at all — meaning they can't sync their Google Workspace (Gmail/Calendar).

WhatsApp is a company-wide toggle (admin-only), so it should be restricted for regular members.

## Plan

### 1. Show Integrations as a top-level sidebar item for members

In `src/components/settings/SettingsSidebar.tsx`:
- Add a new top-level nav item `integrations` (with the Plug icon) that shows when the user is a member but NOT an admin/workspace owner/platform admin. This way members who can't see the Workspace section still get access to Integrations directly.
- Keep the existing Integrations item inside the Workspace submenu for admins/owners (no change there).

### 2. Hide/disable WhatsApp for non-admin members

In `src/components/settings/IntegrationsTab.tsx`:
- Filter out or gray out the WhatsApp integration card for regular members (non-admin, non-workspace-owner).
- Use `usePermissions()` to check `isAdmin || isWorkspaceOwner || isPlatformAdmin`. If false, either hide the WhatsApp card entirely or show it as disabled with a tooltip like "Admin only".

### 3. Ensure Settings.tsx renders IntegrationsTab for members

In `src/pages/Settings.tsx`:
- The `<TabsContent value="integrations">` block is already rendered unconditionally (no permission gate), so members can already access the tab content — no change needed there.

## Files changed

| File | Change |
|------|--------|
| `src/components/settings/SettingsSidebar.tsx` | Add top-level "Integrations" nav item for members who can't see Workspace |
| `src/components/settings/IntegrationsTab.tsx` | Hide or disable WhatsApp card for non-admin users |

