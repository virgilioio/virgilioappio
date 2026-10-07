# Give every user access to Integrations

## What's wrong
Jurre is a Member (Hiring Manager) and has no Google Workspace connected. The Integrations page itself works for everyone, but its menu entry sits inside the "Workspace" group of Settings, and that whole group is hidden for anyone who isn't an admin or owner. So members never see the link.

## Change
- Show **Integrations** in Settings for every user type (members, hiring managers, interviewers, recruiters, sales, admins, owners).
- For non-admins it appears in their personal group (next to Profile, Email & calendar, Booking, Notifications). Admins and owners keep it where it is now, so their menu doesn't change.
- Inside the page, everyone can connect their own Google Workspace. WhatsApp stays admin-only, because it's a workspace-wide setting, not a personal one.
- Direct links (Settings → Integrations, and links from the setup checklist) open the page for everyone.

## After this
Ask Jurre to open Settings → Integrations → Google Workspace → Connect. I can then confirm his email and calendar show as connected.

## Technical details
- `src/components/settings/SettingsSidebar.tsx`: add an `integrations` item to the personal section with `show: !isAdminOrOwner`; keep the workspace-section item for admins/owners.
- No changes to `Settings.tsx` routing (the `integrations` / `integration-*` tabs already render for any user) and no database changes.
