# Notification Center & Preferences

Rebuild the bell-anchored panel and add a Preferences view, backed by a persistent `notifications` table with DB triggers, per-user delivery preferences, browser push, and polling refresh.

## What ships

### 1. Panel (440×640, anchored to bell, 10px offset, over-page scrim 18% citron)

- Header: "Notifications" + "N unread" · right-side icons: mark-all-read (double-check), Preferences (sliders).
- Tabs: All · Mentions · Activity, each with a live count. Right side: Filter chip (placeholder for v2).
- Date groups (Today / Yesterday / Earlier) with count on right.
- Row anatomy per design: 2px purple left bar when unread, 36px avatar with 16px corner glyph badge (system kinds get a tinted icon tile instead of initials), bold actor name in title, subtitle context line, optional purple-wash preview block for mentions, inline actions (one citron-noir primary pill + ghost secondary), timestamp + unread dot top-right.
- 4 kinds rendered live: Mention, Application batch, Scorecard submitted, Interview event. Schema supports the other 4 kinds for later.
- Empty state per tab ("You're all caught up" + tray icon).
- Footer: Mark all read · View all → (goes to `/notifications` full page — out of scope for this pass; link hidden if route not built).
- Bell badge: unread count chip; lilac micro-dot on the bell when there are unread.

### 2. Preferences (in-place swap, "← Back" returns to feed)

- Category × channel table with toggles for IN-APP / EMAIL / PUSH:
  Mentions & comments, New applications, Scorecards submitted, Interview events, Offers & acceptances, Job posting status, Daily digest.
- Delivery section: Quiet hours (toggle + start/end + tz), Play sound on new mention (toggle).
- Save changes button persists to `notification_preferences`.
- "Enable browser notifications" CTA appears when push toggled on but permission not granted; requests `Notification.requestPermission()` and registers a push subscription.

### 3. Delivery wiring

- IN-APP: enforced server-side in the trigger (only writes a notification row if `in_app=true` for that category for that recipient).
- EMAIL: trigger enqueues to `transactional_emails` via the existing send-transactional-email function. One template per category. Suppressed automatically during Quiet hours when set.
- PUSH: edge function `dispatch-push-notification` invoked after insert via a deferred trigger; sends Web Push using VAPID keys to all `push_subscriptions` rows for the recipient where the category is enabled. Service worker registered on app boot.

### 4. Refresh

- React Query `notifications` key with `refetchInterval: 60_000` and refetch on window focus. No realtime channel.

---

## Technical details

### New tables

- `notification_categories` (enum): `mention | application_batch | scorecard_submitted | interview_event | offer_event | posting_status | daily_digest`.
- `notifications`
  - `id, tenant_id, user_id` (recipient, FK auth.users), `category`, `actor_user_id NULL`, `actor_name`, `actor_avatar_url NULL`,
  - `title TEXT`, `subtitle TEXT NULL`, `preview TEXT NULL` (mention quote), `entity_kind` (`candidate|job|offer|booking`), `entity_id UUID NULL`,
  - `job_id UUID NULL`, `candidate_id UUID NULL`, `action_url TEXT NULL`, `metadata JSONB DEFAULT '{}'`,
  - `read_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ DEFAULT now()`.
  - Indexes: `(user_id, read_at, created_at DESC)`, `(tenant_id, created_at DESC)`.
  - RLS: select/update own rows where `user_id = auth.uid()` and tenant-scoped; insert restricted to SECURITY DEFINER trigger functions.
- `notification_preferences`
  - `user_id PK`, per-category `{in_app, email, push} BOOLEAN` columns (21 cols) defaulting true for in_app, true for email on mentions/scorecards/interviews/offers, false elsewhere; push defaults false.
  - `quiet_hours_enabled BOOL`, `quiet_hours_start TIME`, `quiet_hours_end TIME`, `quiet_hours_tz TEXT`, `sound_on_mention BOOL`, `updated_at`.
  - RLS: own row only.
  - Auto-inserted default row via `on_auth_user_created` trigger extension.
- `push_subscriptions`
  - `id, user_id, endpoint UNIQUE, p256dh, auth, user_agent, created_at`. RLS: own.

### Triggers (SECURITY DEFINER, search_path = public)

- `tg_notify_mention` on `candidate_comments AFTER INSERT`: parses `@uuid` mentions in `content`, fan-out one notification per mentioned member (excluding author). Preview = sanitized first 240 chars.
- `tg_notify_scorecard_submitted` on `job_stage_scorecards AFTER UPDATE` when status transitions to `submitted`: notifies job recruiter + job creator (deduped).
- `tg_notify_interview_event` on `scheduled_bookings AFTER INSERT/UPDATE`: confirmed / declined / rescheduled / cancelled → notifies `booked_by` and other interviewers.
- `application_batch`: hourly pg_cron job `rollup_application_batches` that groups new applications in last hour per job and emits one notification per recruiter with `metadata.count` and `metadata.flagged_count`.

Each trigger calls helper `public.emit_notification(...)` which:
1. Reads recipient's `notification_preferences`. If `in_app=false`, skip insert.
2. Inserts row into `notifications`.
3. If `email=true` and not in quiet hours, calls `pg_net` to `send-transactional-email`.
4. If `push=true`, calls `pg_net` to `dispatch-push-notification` (which iterates `push_subscriptions`).

### Edge functions

- `dispatch-push-notification` (new): accepts `{ notification_id }`, loads row + subscriptions, sends Web Push via VAPID. Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- Reuse `send-transactional-email` for email channel; add 6 templates (one per category) scaffolded via the standard transactional flow.

### Client

- New `src/hooks/useNotifications.ts`: query + `markAsRead`, `markAllAsRead`, counts by tab.
- New `src/hooks/useNotificationPreferences.ts`: get/save prefs.
- New `src/hooks/usePushSubscription.ts`: register/unregister, expose permission state.
- New `public/sw.js` service worker handling `push` and `notificationclick` events; registered on app mount.
- Rewrite `src/components/layout/NotificationCenter.tsx` (panel + row variants + empty + preferences view).
- New `src/components/layout/notifications/NotificationRow.tsx`, `NotificationPreferences.tsx`, `NotificationTabs.tsx`.
- Bell trigger styling already in `Header.tsx`; just expose unread count from new hook.

### Required secret

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — generated once and added before push works. UI degrades gracefully (Push toggle disabled with "Set up push" message) until present.

---

## Out of scope

- Full-page `/notifications` route (footer "View all" hidden until built).
- Filter chip behavior beyond the dropdown shell.
- Application batch rollup that crosses tenants (kept hourly per-tenant).
- Offer/posting/assignment/reply kinds (schema-ready, triggers ship later).
- Mobile (panel is desktop-only — bell hidden on `<sm` like today).
