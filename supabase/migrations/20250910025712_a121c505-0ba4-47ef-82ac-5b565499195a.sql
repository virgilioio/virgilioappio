-- Enable the self_serve_admin_enabled feature flag
UPDATE public.platform_feature_flags 
SET is_active = true, updated_at = now() 
WHERE flag_name = 'self_serve_admin_enabled';