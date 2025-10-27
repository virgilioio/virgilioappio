-- Create calendar_identities table
CREATE TABLE calendar_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ DEFAULT now(),
  sync_status TEXT DEFAULT 'healthy' CHECK (sync_status IN ('healthy', 'error', 'expired')),
  sync_error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id, provider, email_address)
);

CREATE INDEX idx_calendar_identities_user ON calendar_identities(user_id);
CREATE INDEX idx_calendar_identities_org ON calendar_identities(organization_id);

-- RLS Policies
ALTER TABLE calendar_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar identities"
  ON calendar_identities FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own calendar identities"
  ON calendar_identities FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own calendar identities"
  ON calendar_identities FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own calendar identities"
  ON calendar_identities FOR DELETE
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_calendar_identities_updated_at
  BEFORE UPDATE ON calendar_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();