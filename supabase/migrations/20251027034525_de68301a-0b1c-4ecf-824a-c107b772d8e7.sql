-- Create booking_configurations table
CREATE TABLE booking_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Unique short code for public URL
  short_code TEXT NOT NULL UNIQUE,

  -- Display information
  display_name TEXT NOT NULL,
  description TEXT,

  -- Status
  is_active BOOLEAN DEFAULT false,

  -- Default availability rules
  available_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',

  -- Booking rules
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_time_minutes INTEGER DEFAULT 15,
  min_notice_hours INTEGER DEFAULT 24,
  max_days_ahead INTEGER DEFAULT 30,

  -- Meeting details
  meeting_location TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_booking_config_short_code ON booking_configurations(short_code);
CREATE INDEX idx_booking_config_user ON booking_configurations(user_id);
CREATE INDEX idx_booking_config_org ON booking_configurations(organization_id);
CREATE INDEX idx_booking_config_active ON booking_configurations(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE booking_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own booking config"
  ON booking_configurations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Public can view active booking configs"
  ON booking_configurations FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can update own booking config"
  ON booking_configurations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Platform admins can manage all booking configs"
  ON booking_configurations FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- Trigger for updated_at
CREATE TRIGGER update_booking_configurations_updated_at
  BEFORE UPDATE ON booking_configurations
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

COMMENT ON TABLE booking_configurations IS 'Stores user booking link configurations for candidate self-scheduling';
COMMENT ON COLUMN booking_configurations.short_code IS 'Unique URL-safe identifier (e.g., john-smith-k7x9)';
COMMENT ON COLUMN booking_configurations.is_active IS 'Only active when user has connected calendar';