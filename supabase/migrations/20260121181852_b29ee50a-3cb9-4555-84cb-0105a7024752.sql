-- Add missing rescheduled_at column to scheduled_bookings
-- This column is used by google-calendar-webhook to track when events are rescheduled
ALTER TABLE public.scheduled_bookings
ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.scheduled_bookings.rescheduled_at IS 
  'Timestamp when the booking was last rescheduled via Google Calendar sync';

-- Allow public (unauthenticated) users to view basic profile info
-- for users who have an active booking configuration
-- This enables the public booking page to display interviewer name/avatar
CREATE POLICY "Public can view profiles for active booking configs"
ON public.profiles FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM booking_configurations bc
    WHERE bc.user_id = profiles.user_id
    AND bc.is_active = true
  )
);