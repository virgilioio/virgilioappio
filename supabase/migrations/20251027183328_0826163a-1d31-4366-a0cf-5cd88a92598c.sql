-- Add cancelled_by column to track who cancelled the booking
ALTER TABLE scheduled_bookings
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN scheduled_bookings.cancelled_by IS 'User ID who cancelled the booking';