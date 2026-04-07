

# Event Types with Per-Event Settings in Side Sheet

## Concept

Instead of the current tabbed settings (Weekly Hours, Meeting Details, Booking Rules) living inline in the Booking Link card, the card will show a **list of event types** with a **"+ Create Event Type"** button. Clicking an event type (or creating a new one) opens a **Sheet** (sliding side panel) containing the three tabs of settings scoped to that event type. This matches the existing UX pattern used across the app (JobFormSheet, StageConfigSheet, etc.).

## Database

### New table: `booking_event_types`

```sql
CREATE TABLE booking_event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_config_id UUID NOT NULL REFERENCES booking_configurations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_time_minutes INTEGER NOT NULL DEFAULT 15,
  min_notice_hours INTEGER NOT NULL DEFAULT 24,
  max_days_ahead INTEGER NOT NULL DEFAULT 30,
  meeting_location TEXT,
  custom_event_title TEXT,
  weekly_schedule JSONB NOT NULL DEFAULT '...', -- same structure as booking_configurations
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  color TEXT DEFAULT '#7c3aed',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(booking_config_id, slug)
);
```

Each event type carries its **own** weekly schedule, duration, buffer, notice, max days, location, and timezone — the full set of settings that currently live on `booking_configurations`. RLS: public read for active types; authenticated users manage their own via booking_config_id.

## Settings UI Redesign

### `BookingLinkSection.tsx` — Simplified

The card keeps: booking URL display, active/inactive toggle. Below that, replace the 3-tab interface with:

```text
┌─────────────────────────────────────────┐
│ Booking Link                    [Active]│
│ Share your personalized booking link    │
│                                         │
│ Public Booking URL                      │
│ [https://app.gogio.io/schedule/...]  📋 │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Event Types              [+ Create New] │
│                                         │
│ ┌─ ■ 30-Minute Chat ─────── 30m ── ✓ ┐│
│ │  Quick introductory call             ││
│ └──────────────────────────────────────┘│
│ ┌─ ■ Deep Dive Interview ── 60m ── ✓ ┐│
│ │  Technical deep dive                 ││
│ └──────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘

Click any event type card → opens Sheet
```

### New: `EventTypeSheet.tsx` — Side Sheet

A `Sheet` (from `@/components/ui/sheet`) sliding in from the right, containing:

- **Header**: Event type title (editable), color picker, active toggle
- **Tabs** (same 3 tabs currently in BookingLinkSection):
  - **Weekly Hours**: SchedulePresets, TimezoneSelector, WeeklyScheduleEditor
  - **Meeting Details**: Duration, buffer, location, event title
  - **Booking Rules**: Min notice, max days ahead
- **Footer**: Save / Delete buttons

This reuses the exact same sub-components (WeeklyScheduleEditor, SchedulePresets, TimezoneSelector, MeetingDurationSelector) that currently live in BookingLinkSection — they just move into the sheet.

### New: `useBookingEventTypes.ts` — Hook

CRUD hook for `booking_event_types` table: list by config ID, create, update, delete, reorder.

## Public Booking Page Changes

### Route update in `App.tsx`

Add: `/schedule/:shortCode/:eventSlug` → same `PublicBookingPage` component.

### `PublicBookingPage.tsx`

1. Fetch event types for the booking config
2. If contextual link (`?t=` / `?ctx=`), skip picker — use config defaults
3. If 0-1 active event types, skip picker
4. If 2+ active event types, show `EventTypePicker` before calendar
5. Selected event type's settings (duration, schedule, etc.) override the parent config

### New: `EventTypePicker.tsx`

Calendly-inspired card list: color accent bar, title, duration, description. Click to proceed to calendar.

## Migration Path

When the feature launches, existing users have zero event types — the booking page works exactly as before using the parent config's settings. Users opt in by creating their first event type.

## Files changed

| File | Change |
|------|--------|
| DB migration | Create `booking_event_types` table with RLS |
| `src/hooks/useBookingEventTypes.ts` | New: CRUD hook for event types |
| `src/components/settings/BookingLinkSection.tsx` | Replace tabs with event type list + create button |
| `src/components/settings/booking/EventTypeSheet.tsx` | New: side sheet with 3-tab settings per event type |
| `src/components/booking/EventTypePicker.tsx` | New: public-facing event type selection |
| `src/pages/PublicBookingPage.tsx` | Fetch event types; show picker or skip; use selected type's settings |
| `src/App.tsx` | Add `/schedule/:shortCode/:eventSlug` route |

