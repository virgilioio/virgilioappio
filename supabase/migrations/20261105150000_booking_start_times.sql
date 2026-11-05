-- Booking links: start times (Allan, 2026-11-05).
--
-- A booking link (booking_configurations) and each of its event types can offer times on
-- a grid instead of back to back from the start of the day:
--   start_interval_minutes  15 | 30 | 60  times every 15 minutes, on the hour and half
--                                         hour, or on the hour (from midnight, in the
--                                         host's time zone)
--                           0 or null     back to back, as before
-- On an event type, null means "same as the booking link" and 0 means back to back.
-- Existing links keep back to back (their value stays null); links made from now on start
-- on the hour and half hour. get-booking-availability offers the times and create-booking
-- accepts only times on the grid.

alter table public.booking_configurations
  add column if not exists start_interval_minutes smallint;
alter table public.booking_configurations
  alter column start_interval_minutes set default 30;
alter table public.booking_configurations
  drop constraint if exists booking_configurations_start_interval_check;
alter table public.booking_configurations
  add constraint booking_configurations_start_interval_check
  check (start_interval_minutes is null or start_interval_minutes in (0, 15, 30, 60));

alter table public.booking_event_types
  add column if not exists start_interval_minutes smallint;
alter table public.booking_event_types
  drop constraint if exists booking_event_types_start_interval_check;
alter table public.booking_event_types
  add constraint booking_event_types_start_interval_check
  check (start_interval_minutes is null or start_interval_minutes in (0, 15, 30, 60));

comment on column public.booking_configurations.start_interval_minutes is
  'Start times: 15, 30 or 60 = on that grid from midnight (host time zone); 0 or null = back to back.';
comment on column public.booking_event_types.start_interval_minutes is
  'Start times for this event type: null = same as the booking link; 0 = back to back; 15, 30 or 60 = on that grid.';
