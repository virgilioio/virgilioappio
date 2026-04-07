
-- Create booking_event_types table
CREATE TABLE public.booking_event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_config_id UUID NOT NULL REFERENCES public.booking_configurations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_time_minutes INTEGER NOT NULL DEFAULT 15,
  min_notice_hours INTEGER NOT NULL DEFAULT 24,
  max_days_ahead INTEGER NOT NULL DEFAULT 30,
  meeting_location TEXT,
  custom_event_title TEXT,
  weekly_schedule JSONB NOT NULL DEFAULT '{
    "monday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "tuesday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "wednesday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "thursday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "friday": {"enabled": true, "start": "09:00", "end": "17:00"},
    "saturday": {"enabled": false, "start": "09:00", "end": "17:00"},
    "sunday": {"enabled": false, "start": "09:00", "end": "17:00"}
  }'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  color TEXT DEFAULT '#7c3aed',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(booking_config_id, slug)
);

-- Enable RLS
ALTER TABLE public.booking_event_types ENABLE ROW LEVEL SECURITY;

-- Public read for active event types (needed for public booking page)
CREATE POLICY "Anyone can view active event types"
ON public.booking_event_types
FOR SELECT
USING (is_active = true);

-- Authenticated users can manage event types for their own booking configs
CREATE POLICY "Users can manage their own event types"
ON public.booking_event_types
FOR ALL
TO authenticated
USING (
  booking_config_id IN (
    SELECT id FROM public.booking_configurations WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  booking_config_id IN (
    SELECT id FROM public.booking_configurations WHERE user_id = auth.uid()
  )
);

-- Index for fast lookups
CREATE INDEX idx_booking_event_types_config_id ON public.booking_event_types(booking_config_id);

-- Trigger for updated_at
CREATE TRIGGER update_booking_event_types_updated_at
BEFORE UPDATE ON public.booking_event_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
