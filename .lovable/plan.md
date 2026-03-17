

# Integration Detail Dialog + Sidebar Sub-items

## Overview

Replace the current "click card → open config sheet" flow with a two-step experience:

1. **Click card → open a Dialog** showing integration details with Install/Uninstall + Configure buttons
2. **Installed integrations appear as sub-items** under "Integrations" in the settings sidebar; clicking a sub-item opens the existing config Sheet

## Changes

### 1. New component: `IntegrationDetailDialog.tsx`

A centered Dialog that receives the integration entry + connection status. Contains:
- Large logo + integration name + category badge
- Full description text
- **Install** button (primary, shown when not connected) / **Uninstall** button (destructive outline, shown when connected)
- **Configure** button (secondary, shown only when connected) — closes dialog and opens the config Sheet
- Install/Uninstall will call the same toggle logic that currently exists (e.g., WhatsApp's `toggle()`, Google's OAuth flow, Chrome's token generation)

### 2. Update `IntegrationCard.tsx`

- Remove the "Configure" button from the card footer
- Card click now opens the detail Dialog instead of the Sheet
- Keep the Connected/Not Connected badge as-is

### 3. Update `IntegrationsTab.tsx`

- Replace the current `activeId` → Sheet flow with `activeId` → Dialog flow
- Add a separate `configureId` state that opens the Sheet (triggered from the Dialog's "Configure" button or from the sidebar sub-item)
- Keep the existing Sheet rendering for the DetailComponent

### 4. Update `IntegrationEntry` interface

- Add an `installAction` and `uninstallAction` to each integration entry (or reuse the existing `useIsConnected` hook pattern with a toggle callback)
- Each integration needs an install/uninstall handler:
  - **WhatsApp**: calls `toggle(true/false)` from `useWorkspaceAutomation`
  - **Google Workspace**: install triggers the OAuth connect flow; uninstall disconnects identities
  - **Chrome Extension**: install is essentially a no-op (shows token); uninstall clears token

### 5. Update `SettingsSidebar.tsx`

- Under the existing "Integrations" submenu item within Workspace, dynamically render sub-items for each **installed** integration
- Each sub-item uses the integration's logo as icon and name as label
- Clicking a sub-item sets `currentTab` to `integration-{id}` (e.g., `integration-whatsapp`)
- The sidebar needs access to connection statuses — pass them via a shared hook or context

### 6. Update `Settings.tsx`

- Add `TabsContent` entries for `integration-{id}` tabs that render the config Sheet content inline (or auto-open the Sheet)
- When navigating to `integration-whatsapp` etc., render the IntegrationsTab with the config Sheet pre-opened for that integration

## Technical Details

- The Dialog uses the existing `src/components/ui/dialog.tsx` component
- Connection status hooks (`useGoogleConnected`, `useWhatsAppConnected`, `useChromeConnected`) need to be extracted from `IntegrationsTab.tsx` into a shared file so both the sidebar and the integrations tab can use them
- New file: `src/hooks/useIntegrationStatuses.ts` — exports the three hooks and a combined `useIntegrationStatuses()` that returns a `Record<string, boolean>`
- The sidebar will import `useIntegrationStatuses` to know which sub-items to show
- The `INTEGRATIONS` array definition moves to `integrationRegistry.ts` (or a new `integrationDefinitions.ts`) so it can be imported by both the sidebar and the tab

## File Summary

| File | Action |
|------|--------|
| `src/components/settings/IntegrationDetailDialog.tsx` | Create |
| `src/hooks/useIntegrationStatuses.ts` | Create — extract connection hooks |
| `src/components/settings/IntegrationCard.tsx` | Edit — remove Configure button, change click to open dialog |
| `src/components/settings/IntegrationsTab.tsx` | Edit — add dialog state, keep sheet for configure |
| `src/components/settings/SettingsSidebar.tsx` | Edit — add dynamic integration sub-items |
| `src/pages/Settings.tsx` | Edit — handle `integration-{id}` tab routes |

