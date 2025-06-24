
-- Insert missing platform settings records for terms and conditions and privacy policy
INSERT INTO public.platform_settings (setting_key, display_name, description, setting_type, setting_value)
VALUES 
  (
    'terms_and_conditions',
    'Terms and Conditions',
    'Platform terms and conditions content',
    'html',
    NULL
  ),
  (
    'privacy_policy', 
    'Privacy Policy',
    'Platform privacy policy content',
    'html',
    NULL
  )
ON CONFLICT (setting_key) DO NOTHING;
