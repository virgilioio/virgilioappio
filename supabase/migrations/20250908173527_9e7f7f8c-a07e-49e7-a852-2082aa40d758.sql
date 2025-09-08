-- Create platform feature flags table
CREATE TABLE IF NOT EXISTS platform_feature_flags (
  flag_name TEXT PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert the self-serve admin flag (disabled by default)
INSERT INTO platform_feature_flags(flag_name, is_active)
VALUES ('self_serve_admin_enabled', FALSE)
ON CONFLICT (flag_name) DO NOTHING;

-- Create RLS policies for platform feature flags
ALTER TABLE platform_feature_flags ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view and manage feature flags
CREATE POLICY "Platform admins can view feature flags"
ON platform_feature_flags FOR SELECT
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can manage feature flags"
ON platform_feature_flags FOR ALL
USING (get_user_type_secure() = 'platform_admin');

-- Create helper function to get feature flag status
CREATE OR REPLACE FUNCTION public.get_feature_flag(flag_name_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  flag_active BOOLEAN := FALSE;
BEGIN
  SELECT is_active INTO flag_active
  FROM public.platform_feature_flags
  WHERE flag_name = flag_name_param;
  
  RETURN COALESCE(flag_active, FALSE);
END;
$$;