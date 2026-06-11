# Settings Revamp — Implementation Plan

A strict re-skin and re-IA of the entire Settings area. Backend reuse is the rule: wire to existing org/members/departments/integrations/job-settings/deal-stages/Stripe data. No new schemas. Locally persist + TODO only where a new pref has no backend (notifications, careers page toggles new to spec).

## Scope split into 4 phases (delivered in this order, single build)

### Phase 1 — Shell + new IA
1. **`src/pages/Settings.tsx`** — rebuild layout. Replace `AppContainer + Section` wrapper with `padding 24px 28px` page; replace floating `SettingsSidebar` (Card) with a **flat rail** on page bg. New grid `224px nav / minmax(0,1fr) content (max-w 860px)`, gap 26. Header: `Settings.` (Poppins, existing token) + meta line `{tenant.name} · {n} of {m} essentials configured`.
2. **`src/components/settings/SettingsSidebar.tsx`** — rewrite as flat list (no Card). Group labels (Inter 10/600 uppercase 0.08em #8B8F9E). Items 7px 10px, radius 8, icon 14px lucide, Inter 12.5px. Active = `#0d0d09` bg, cream text. Hover `rgba(13,13,9,0.05)`. New IA order:
   - Setup (badge: remaining essentials, lilac)
   - YOU: Profile, Email & calendar, Booking & event types, Notifications
   - WORKSPACE: General, Members, Departments, Integrations, Billing (OWNERS mini-badge, owner-only)
   - RECRUITING: Pipeline stages, Application form, Templates, Automations, Careers page, Job boards
   - CRM: Deal stages, Customers
3. **Route redirects**: old `?tab=workspace-job-settings` → split into the 6 new recruiting tabs. `?tab=platform-saas-customers` → `?tab=customers`. Keep Platform routes intact (out of scope) but remove from nav.
4. **Profile single-entry**: move profile into Settings · Profile. Top-bar avatar menu "My profile" routes to `/settings?tab=profile`. Remove the bottom-rail profile entry.
5. **Permissions gating**: non-admins see Setup + YOU only; owners additionally see Billing.

### Phase 2 — YOU group
- **Profile** (`ProfileTab.tsx` restyle): 64px avatar + Change photo; 2-col grid First/Last, Title, Email (read-only, "Your sign-in email."), Phone, Timezone; full-width LinkedIn URL with hint. Footer-right noir "Save changes". Below: read-only **Account card** with user_type + member_role chips.
- **Email & calendar** (new `EmailCalendarTab.tsx`): Google Workspace + Microsoft 365 cards. Wire to existing mail/calendar identity hooks (`useMailIdentities`, `useCalendarIdentities`). Chips "Mail · send-only", "Calendar · two-way". Trust line.
- **Booking & event types** (new `BookingTab.tsx`): move the existing booking system from My Profile here without losing functionality. Two cards: Booking link (toggle + mono URL + Copy/Open), Event types (rows + Create + Edit sheet). Edit sheet keeps existing Weekly hours / Meeting / Rules tabs as pills.
- **Notifications** (new `NotificationsTab.tsx`): 3-col grid with toggles. Local-persist via `localStorage` + TODO comment (no backend).

### Phase 3 — Workspace + Recruiting + CRM re-skin
- **General** (`OrganizationTab.tsx` restyle): Company card (name, created RO, About w/ hint, billing email/phone, Tenant ID mono) + Save. Base currency card + Refresh rates.
- **Members** (`MembersTab.tsx` restyle): metric strip (Paid seats / Free collaborators / Deactivated). Team members card; existing rows restyled to chip system. Lock footer note.
- **Departments** (`DepartmentsManager.tsx` restyle): single card, columns Name (+Default chip), Open, Total, Status, pencil/archive. Also **fix the `counts` Map→Record bug** that crashes Settings (use `counts?.[d.id]`).
- **Integrations** (`IntegrationsTab.tsx` restyle): one card, 3-up grid (LinkedIn Companion, Google Workspace, WhatsApp) with Installed/Not installed chip + Configure/Install.
- **Pipeline stages, Application form, Templates, Automations, Careers page, Job boards**: route each to the existing component currently nested in `JobSettingsManager`; restyle to the shared card formula. Templates uses pill sub-nav.
- **Deal stages** (`DealStagesManager.tsx` restyle): row list w/ grip handle, chip, pencil/trash, Add stage.
- **Customers**: route to `SaaSCustomersList` reskinned (or alias) under CRM · Customers.

### Phase 4 — Billing redesign + Setup
- **Billing** (`pages/settings/Billing.tsx` rebuild):
  1. Metric strip: Plan / Paid seats / Credits/month / Next billing date.
  2. Your plan card: green Active chip, "Team seats" split bar (purple paid + lilac free), legend, View team link, info row w/ sparkles.
  3. Payment method: shield-check, "Stripe connected", "Visa ·· 4242 · next charge on renewal", Verified chip. Header: Manage + Stripe dashboard.
  4. Credit bundles: 3 columns separated by hairlines, middle column tinted `#FBFAFF` w/ purple "Most popular" + noir Buy now.
  5. Billing history: invoice list or one-line empty state.
- **Setup** (new `SetupTab.tsx`): three tier cards (You / Your workspace / Grow). Row = 30px icon tile, title, status chip, blocks note, time estimate, noir Set up/Continue. Done rows 55% opacity. Status derived from real state (mail identity, calendar identity, logo, departments count, members count, scorecard templates count). Footer note. Badge count → remaining essentials.

## Files to add
- `src/components/settings/tabs/SetupTab.tsx`
- `src/components/settings/tabs/EmailCalendarTab.tsx`
- `src/components/settings/tabs/BookingTab.tsx`
- `src/components/settings/tabs/NotificationsTab.tsx`
- `src/components/settings/shared/MetricStrip.tsx`
- `src/components/settings/shared/SettingsCard.tsx`
- `src/components/settings/shared/StatusChip.tsx`

## Files to edit
- `src/pages/Settings.tsx`, `src/components/settings/SettingsSidebar.tsx`
- `src/components/settings/{ProfileTab, MembersTab, OrganizationTab, DepartmentsManager, IntegrationsTab, DealStagesManager}.tsx`
- `src/pages/settings/Billing.tsx`
- top-bar avatar menu (where "My profile" lives) + left-sidebar (remove bottom profile entry)
- routing for tab keys in `Settings.tsx`

## Crash fix (bonus, requested earlier)
`DepartmentsManager.tsx`: change `useJobCountsByDepartment` to return `Record<string,{total,open}>` and read with `counts?.[d.id]` so React Query persister doesn't lose the Map prototype on Settings.

## Out of scope
Platform settings (App Personalization, SaaS Customers admin), Stripe BYOK, schema changes.

## Risk + size note
This is a very large change — roughly 15–20 file edits and 7 new files. I'll deliver it as one build, but a single subsequent message may be needed for polish if any restyled subcomponent (Templates inner tabs, edit-event sheet) needs deeper rework than a CSS pass.

**Approve to start with Phase 1 (shell + nav) and proceed through Phase 4.**
