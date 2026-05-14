## Plan: Restyle Settings Sidebar (visual only)

Pure aesthetic refactor of `src/components/settings/SettingsSidebar.tsx` to match the uploaded reference. No changes to section names, order, visibility logic, tab IDs, routing, or which items render for which roles.

### Visual changes

1. **Card shell**
   - Keep `Card` wrapper, refine to: white bg, soft shadow, rounded-xl, thin border.
   - Header block: `Settings` in bold with the small `.` accent dot kept (currently `text-virgilio-purple` — preserved). Add a second line below with the workspace/tenant name + role label (e.g. "Acme Talent · Workspace") using existing tenant data already available via `useAuth`/`useTenant` (read-only display, no logic changes).

2. **Flatten groups into labeled sections**
   - Replace the `Collapsible` Workspace and Platform groups with non-collapsible sections that always show their children when visible.
   - Each section gets an uppercase muted label header: `ACCOUNT`, `WORKSPACE`, `PLATFORM`.
   - "Account" section will contain the existing top-level non-grouped items (Billing, Integrations-for-members) since the reference uses an Account grouping. Order and visibility rules unchanged.
   - Remove chevron toggles and collapsed/open state — sections are always expanded.

3. **Item styling**
   - Default item: `h-9`, icon left (`h-4 w-4`), label, optional right-aligned badge.
   - Hover: subtle muted background, no translate-y movement (calm/restrained per design system).
   - Active: solid near-black background (`bg-foreground text-background`) with rounded-md, matching the screenshot's pill highlight. Replace current purple gradient on active items.
   - Remove the indented left border treatment for sub-items; all items render at the same indent inside their section.

4. **Badges**
   - Add right-aligned badge slot for items that already expose counts in the app:
     - Members → existing member count (already fetched elsewhere; reuse `useMembers`/existing hook if trivially available, otherwise omit badge to keep this a pure visual pass).
     - Integrations → installed integration count from `installedIntegrations.length` (already computed in this file).
     - Billing → "Trial" pill if `useBillingStatus` indicates trial (only if already easily readable; otherwise omit).
   - Badges use small muted pill: `text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground`.
   - If a count/status isn't already available without new data fetching, skip that badge — visual-only constraint.

5. **Installed integrations sub-list**
   - Keep the existing nested rendering of installed integrations under the Integrations item, restyled to match: smaller height, lighter text, no purple highlight on active — use the same near-black active pill, just smaller.

6. **Spacing & typography**
   - Section label: `text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-1`.
   - Item label: `text-sm font-medium`.
   - Tighter vertical rhythm between items (`space-y-0.5`).

### Out of scope
- No changes to `Settings.tsx`, routes, tab IDs, or which tabs render.
- No changes to permissions/visibility predicates (`item.show`).
- No changes to badge data sources beyond what is already wired in this file.
- No changes to the main content area or any other settings component.

### File touched
- `src/components/settings/SettingsSidebar.tsx` (only).
