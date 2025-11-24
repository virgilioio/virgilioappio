-- Create careers_page_settings table
CREATE TABLE IF NOT EXISTS public.careers_page_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Branding
  logo_url TEXT,
  company_website_url TEXT,
  
  -- Company slug for public URL
  company_slug TEXT UNIQUE NOT NULL,
  
  -- Page customization
  page_title TEXT DEFAULT 'Careers',
  header_text TEXT,
  show_company_name BOOLEAN DEFAULT true,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_careers_page_slug ON public.careers_page_settings(company_slug) WHERE is_active = true;

-- Auto-generate slug from tenant name on insert
CREATE OR REPLACE FUNCTION public.generate_careers_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_slug IS NULL THEN
    NEW.company_slug := lower(regexp_replace(
      (SELECT name FROM public.tenants WHERE id = NEW.tenant_id),
      '[^a-zA-Z0-9]', '-', 'g'
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_generate_careers_slug
BEFORE INSERT ON public.careers_page_settings
FOR EACH ROW
EXECUTE FUNCTION public.generate_careers_slug();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_careers_page_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_careers_page_settings_updated_at
BEFORE UPDATE ON public.careers_page_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_careers_page_updated_at();

-- RLS Policies
ALTER TABLE public.careers_page_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own tenant's careers page settings
CREATE POLICY careers_settings_select
ON public.careers_page_settings FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.members WHERE user_id = auth.uid() AND user_status = 'active'
  )
  OR get_user_type_secure() = 'platform_admin'
);

-- Workspace owners can update their tenant's settings
CREATE POLICY careers_settings_update
ON public.careers_page_settings FOR UPDATE
TO authenticated
USING (
  user_is_workspace_owner_in_tenant(tenant_id)
  OR get_user_type_secure() = 'platform_admin'
)
WITH CHECK (
  user_is_workspace_owner_in_tenant(tenant_id)
  OR get_user_type_secure() = 'platform_admin'
);

-- Workspace owners can insert
CREATE POLICY careers_settings_insert
ON public.careers_page_settings FOR INSERT
TO authenticated
WITH CHECK (
  user_is_workspace_owner_in_tenant(tenant_id)
  OR get_user_type_secure() = 'platform_admin'
);

-- Public can view active careers pages (for the public page)
CREATE POLICY careers_settings_public_select
ON public.careers_page_settings FOR SELECT
TO anon
USING (is_active = true);

-- Create storage bucket for careers logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('careers-logos', 'careers-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for careers-logos bucket
CREATE POLICY "Public can view careers logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'careers-logos');

CREATE POLICY "Workspace owners can upload careers logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'careers-logos' AND
  (
    user_is_workspace_owner_in_tenant(
      (storage.foldername(name))[1]::uuid
    )
    OR get_user_type_secure() = 'platform_admin'
  )
);

CREATE POLICY "Workspace owners can update their careers logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'careers-logos' AND
  (
    user_is_workspace_owner_in_tenant(
      (storage.foldername(name))[1]::uuid
    )
    OR get_user_type_secure() = 'platform_admin'
  )
);

CREATE POLICY "Workspace owners can delete their careers logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'careers-logos' AND
  (
    user_is_workspace_owner_in_tenant(
      (storage.foldername(name))[1]::uuid
    )
    OR get_user_type_secure() = 'platform_admin'
  )
);