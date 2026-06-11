## What's actually in the app

The DB table `public.notification_preferences` defines the real notification surface — and our current UI doesn't match it. There are **7 event types**, each toggleable across **3 channels** (in-app · email · push), plus **quiet hours** and **sound on mention**.

### Real notification events (from DB)

| Event | In-app default | Email default | Push default |
|---|---|---|---|
| **Mentions** — when someone @mentions you in a candidate comment | ✓ | ✓ | — |
| **New applications** — batched digest of new candidates applying to your jobs | ✓ | — | — |
| **Scorecard submitted** — when a teammate submits a scorecard on a candidate you follow | ✓ | — | — |
| **Interview events** — interview scheduled, rescheduled, or canceled | ✓ | ✓ | — |
| **Offer events** — offer created, approval requested, approved, signed | ✓ | ✓ | — |
| **Job posting status** — posting published, expired, board sync failures | ✓ | — | — |
| **Daily digest** — once-a-day summary of pipeline activity | — | — | — |

### Plus

- **Quiet hours** — start/end time + timezone, mutes in-app sounds & push during window
- **Sound on @mention** — toggle the chime when a mention notification arrives

## Plan

Rebuild `src/components/settings/tabs/NotificationsTab.tsx` to read/write the real `notification_preferences` row for `auth.uid()` (replace the current `localStorage` mock).

### Card 1 — Notification matrix
- Single `SettingsCard` titled **"What to notify me about"**
- Column headers: **In-app · Email · Push**
- 7 rows (one per event above), each with a short label + helper line and 3 `Switch`es
- Bind each switch to its `{category}_{channel}` boolean column

### Card 2 — Delivery preferences
- `SettingsCard` titled **"Delivery"**
- **Quiet hours** row: master `Switch` + two `TimePicker`-style inputs (start / end) + timezone select (defaults to user TZ)
- **Sound on @mention** row: single `Switch`

### Data layer
- New hook `useNotificationPreferences()` — `select * from notification_preferences where user_id = auth.uid()`, upsert on change, optimistic update, debounced save (300ms) per field
- If no row exists, treat all fields as their DB defaults and insert on first toggle

### Out of scope
- No schema changes — the table already has every column we need
- Push channel switches render but stay disabled with a small "Coming soon" hint until web-push is wired up (rows where push columns exist but no transport is live)

### Files touched
- `src/components/settings/tabs/NotificationsTab.tsx` — full rewrite
- `src/hooks/useNotificationPreferences.ts` — new

Want me to proceed with this, or trim/expand any of the 7 events first?
