-- Migration A: user_mail_identities table
-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create user_mail_identities table
CREATE TABLE public.user_mail_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Provider info
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  
  -- OAuth tokens (encrypted)
  access_token TEXT,
  refresh_token_encrypted TEXT, -- Encrypted using pgcrypto
  token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- IMAP credentials (encrypted if used)
  imap_username TEXT,
  imap_password_encrypted TEXT, -- Encrypted using pgcrypto
  imap_host TEXT,
  imap_port INTEGER,
  
  -- SMTP credentials (encrypted if used)
  smtp_username TEXT,
  smtp_password_encrypted TEXT, -- Encrypted using pgcrypto
  smtp_host TEXT,
  smtp_port INTEGER,
  
  -- Status and metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT CHECK (sync_status IN ('healthy', 'error', 'pending')),
  sync_error TEXT,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(user_id, email_address),
  CHECK (
    (provider = 'gmail' AND access_token IS NOT NULL) OR
    (provider = 'outlook' AND access_token IS NOT NULL) OR
    (provider = 'imap' AND imap_host IS NOT NULL)
  )
);

-- Create index for faster lookups
CREATE INDEX idx_user_mail_identities_user_id ON public.user_mail_identities(user_id);
CREATE INDEX idx_user_mail_identities_org_id ON public.user_mail_identities(organization_id);
CREATE INDEX idx_user_mail_identities_active ON public.user_mail_identities(user_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.user_mail_identities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_mail_identities
-- Users can view their own mail identities
CREATE POLICY "Users can view their own mail identities"
  ON public.user_mail_identities
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own mail identities
CREATE POLICY "Users can insert their own mail identities"
  ON public.user_mail_identities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own mail identities
CREATE POLICY "Users can update their own mail identities"
  ON public.user_mail_identities
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own mail identities
CREATE POLICY "Users can delete their own mail identities"
  ON public.user_mail_identities
  FOR DELETE
  USING (auth.uid() = user_id);

-- Platform admins can manage all mail identities
CREATE POLICY "Platform admins can manage all mail identities"
  ON public.user_mail_identities
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- Helper functions for encryption/decryption
-- Encrypt refresh token
CREATE OR REPLACE FUNCTION public.encrypt_refresh_token(token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from environment or generate a stable one
  -- In production, this should be set via Supabase secrets
  encryption_key := COALESCE(
    current_setting('app.encryption_key', true),
    'default-encryption-key-change-in-production'
  );
  
  RETURN encode(
    pgp_sym_encrypt(token, encryption_key),
    'base64'
  );
END;
$$;

-- Decrypt refresh token
CREATE OR REPLACE FUNCTION public.decrypt_refresh_token(encrypted_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  
  encryption_key := COALESCE(
    current_setting('app.encryption_key', true),
    'default-encryption-key-change-in-production'
  );
  
  RETURN pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    encryption_key
  );
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_mail_identities_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_mail_identities_updated_at
  BEFORE UPDATE ON public.user_mail_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_mail_identities_updated_at();

-- Comments
COMMENT ON TABLE public.user_mail_identities IS 'Stores user email account credentials for sending emails through their own mail providers';
COMMENT ON COLUMN public.user_mail_identities.refresh_token_encrypted IS 'OAuth refresh token encrypted using pgcrypto pgp_sym_encrypt';
COMMENT ON COLUMN public.user_mail_identities.imap_password_encrypted IS 'IMAP password encrypted using pgcrypto pgp_sym_encrypt';
COMMENT ON COLUMN public.user_mail_identities.smtp_password_encrypted IS 'SMTP password encrypted using pgcrypto pgp_sym_encrypt';