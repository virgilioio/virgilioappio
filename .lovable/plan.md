## Goal

Surface "Companies" as a top-nav item in the global Header (matching the ATS section's items like Find/Jobs/Pipeline), and remove the in-page Tabs wrapper from the CRM page.

## Changes

### 1. `src/components/layout/Header.tsx`
- Add a new entry to `navigationItems` with `section: 'crm'`:
  - `href: '/crm'`
  - `icon: Building2` (Lucide) — closest match for "Companies"
  - `label: 'Companies'`
  - `show: canViewOrganizations` (use existing permission already in scope or add it from `usePermissions`)
- No other Header logic changes — `getActiveSection` already returns `'crm'` for `/crm`, so the filter `item.section === activeSection` will render Companies only when in the CRM section.

### 2. `src/pages/CRM.tsx`
- Remove the local `Tabs` / `TabsList` / `TabsTrigger` wrapper and the search-param tab routing.
- Render `<OrganizationsTab />` directly inside `AppContainer` / `Section` — same container pattern as Jobs/Pipeline.
- Keep the `canViewOrganizations` permission gate and the `h-[100dvh]` fixed viewport.

## Out of scope

- No changes to icon, label, or layout of existing ATS items.
- No additional CRM tabs (Contacts/Deals) — only Companies for now.
- No change to the sidebar CRM icon or active-state logic.
