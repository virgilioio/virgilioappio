-- Remove advertising-related platform settings
DELETE FROM public.platform_settings 
WHERE setting_key IN (
  'ad_banner_enabled',
  'ad_banner_title', 
  'ad_banner_body',
  'ad_banner_button_text',
  'ad_banner_button_url',
  'ad_banner_bg_color'
);