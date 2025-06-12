
-- Create assets storage bucket for platform branding files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
);

-- Create storage policies for assets bucket (public read, admin write)
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

-- Create platform_assets table to track current active assets
CREATE TABLE public.platform_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('logo', 'favicon')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure only one active asset per type
  UNIQUE(asset_type, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Enable RLS on platform_assets
ALTER TABLE public.platform_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for platform_assets
CREATE POLICY "Anyone can view active platform assets" 
ON public.platform_assets FOR SELECT 
USING (is_active = true);

CREATE POLICY "Platform admins can manage platform assets" 
ON public.platform_assets FOR ALL 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.members 
    WHERE user_type = 'platform_admin'
  )
);

-- Create function to handle asset updates (deactivate old, activate new)
CREATE OR REPLACE FUNCTION public.activate_platform_asset(
  new_asset_id UUID,
  asset_type_param TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deactivate existing assets of the same type
  UPDATE public.platform_assets 
  SET is_active = false, updated_at = now()
  WHERE asset_type = asset_type_param AND is_active = true;
  
  -- Activate the new asset
  UPDATE public.platform_assets 
  SET is_active = true, updated_at = now()
  WHERE id = new_asset_id;
END;
$$;

-- Add updated_at trigger for platform_assets
CREATE TRIGGER update_platform_assets_updated_at
  BEFORE UPDATE ON public.platform_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
