-- Remove advanced legal/compliance document editors
-- This migration removes legal document management platform settings

-- Remove legal document platform settings
DELETE FROM public.platform_settings 
WHERE setting_key IN ('terms_and_conditions', 'privacy_policy');