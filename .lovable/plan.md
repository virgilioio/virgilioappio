## Goal

Move "Departments" out of Settings into the new CRM section, rename it to "Companies", and surface it as a tab in a top navigation header on the CRM page.

## Changes

### 1. Create the CRM page — `src/pages/CRM.tsx` (new)
- Wraps content in standard fixed viewport (`h-[100dvh]`) like other modules.
- Top navigation header with one tab for now: **Companies** (room for future tabs like Contacts, Pipelines).
- Active tab renders the existing `OrganizationsTab` content, but with the page title updated to **Companies** instead of **Departments** when used in this context.
- Permission gate: requires `canViewOrganizations`. If denied, show a simple "no access" empty state.

### 2. Rename "Departments" → "Companies" inside the table view
- Update the `PageHeader` title in `src/components/settings/OrganizationsTab.tsx` from "Departments" to "Companies".
- Update the deactivation confirmation copy from "deactivate this department" to "deactivate this company".
- All other internal IDs (`organizations`, hooks, table component name) stay as-is to avoid touching the data layer — purely a label change.

### 3. Remove from Settings sidebar — `src/components/settings/SettingsSidebar.tsx`
- Remove the `organizations` / "Departments" nav item (lines 44–50).
- Settings keeps Billing, Workspace, Platform, Integrations, etc.

### 4. Update Settings default tab — `src/pages/Settings.tsx`
- Remove the `OrganizationsTab` import and the `<TabsContent value="organizations">` block.
- In `pickDefaultSettingsTab()`, drop `'organizations'` from the fallback so the default lands on the next available tab (workspace, integrations, etc.).

### 5. Wire the route — `src/App.tsx`
- Add `<Route path="/crm" element={<CRM />} />` inside the authenticated routes block (next to `/jobs`, `/pipeline`).
- Update the legacy redirect `path="/organizations"` from `/settings?tab=organizations` to `/crm` so existing links keep working.

### 6. Sidebar active-state — `src/components/layout/AppSidebar.tsx`
- Already routes `/crm` to the CRM section icon; no change needed.

## Out of scope

- Database/table renames (still `organizations` internally).
- Adding additional CRM tabs (Contacts, Deals, etc.) — only "Companies" for now.
- Changing the `organizations` permission key or the underlying CRUD/form components.
- Restyling the table itself.
