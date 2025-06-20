
-- Create storage policies for assets bucket (public read, admin write)
-- First drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view assets" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can delete assets" ON storage.objects;

-- Create new storage policies
CREATE POLICY "Anyone can view assets" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'assets');

CREATE POLICY "Platform admins can upload assets" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'assets' 
  AND auth.uid() IN (
    SELECT user_id FROM public.members 
    WHERE user_type = 'platform_admin'
  )
);

CREATE POLICY "Platform admins can update assets" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'assets' 
  AND auth.uid() IN (
    SELECT user_id FROM public.members 
    WHERE user_type = 'platform_admin'
  )
);

CREATE POLICY "Platform admins can delete assets" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'assets' 
  AND auth.uid() IN (
    SELECT user_id FROM public.members 
    WHERE user_type = 'platform_admin'
  )
);

-- Create platform_settings table for browser title and other settings
CREATE TABLE public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type TEXT NOT NULL DEFAULT 'text',
  display_name TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on platform_settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for platform_settings
CREATE POLICY "Anyone can view platform settings" 
ON public.platform_settings FOR SELECT 
USING (true);

CREATE POLICY "Platform admins can manage platform settings" 
ON public.platform_settings FOR ALL 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.members 
    WHERE user_type = 'platform_admin'
  )
);

-- Add updated_at trigger for platform_settings
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default browser title setting
INSERT INTO public.platform_settings (setting_key, setting_value, setting_type, display_name, description)
VALUES (
  'browser_title',
  'Virgilio.io - Multi-tenant Hiring Platform',
  'text',
  'Browser Tab Title',
  'The title that appears in browser tabs across the platform'
);
