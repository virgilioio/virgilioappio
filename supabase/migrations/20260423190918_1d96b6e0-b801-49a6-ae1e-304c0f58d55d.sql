-- Backfill stale timezone defaults
-- 1. Booking configs stuck on UTC: backfill from profile timezone
update public.booking_configurations bc
set timezone = p.timezone
from public.profiles p
where bc.user_id = p.user_id
  and bc.timezone = 'UTC'
  and p.timezone is not null
  and p.timezone <> ''
  and p.timezone <> 'UTC';

-- 2. Event types stuck on America/New_York that don't match parent config:
--    backfill from parent booking config timezone
update public.booking_event_types et
set timezone = bc.timezone
from public.booking_configurations bc
where et.booking_config_id = bc.id
  and et.timezone = 'America/New_York'
  and bc.timezone is not null
  and bc.timezone <> ''
  and bc.timezone <> 'America/New_York';