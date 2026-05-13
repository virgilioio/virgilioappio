## Plan: Merge Currency into General Settings

Rename "Company Profile" to "General Settings" and embed the currency management UI inside that same tab. Remove the standalone Currency sidebar entry.

### Changes

1. **`src/components/settings/SettingsSidebar.tsx`**
   - Rename the `organization` item label from `Company Profile` to `General Settings`.
   - Remove the `workspace-currency` sidebar item.
   - Remove `workspace-currency` from the workspace-tabs array used to keep the Workspace group expanded.

2. **`src/components/settings/OrganizationTab.tsx`**
   - Replace the `PageHeader` title `Company Profile` with `General Settings` in all five occurrences (loading, error, empty, read-only, edit views).
   - Keep the existing `Company Information` Card as-is (still represents the company profile section within General Settings).
   - Append a new section below the existing company cards that renders `<CurrencySettings />` so currency lives inside the same tab. It will render for all users who can view the tab (CurrencySettings already handles its own admin gating internally).

3. **`src/pages/Settings.tsx`**
   - Remove the `<TabsContent value="workspace-currency">` block and the now-unused `CurrencySettings` import (since it's used inside `OrganizationTab` instead).

4. **Backwards compatibility**
   - If a user lands on `?tab=workspace-currency` (current route), redirect/fallback to `?tab=organization` so the existing link the user is on still works.

### Out of scope
- No changes to currency data model, hooks, or business logic.
- No visual redesign of the currency UI itself; it's relocated as-is.