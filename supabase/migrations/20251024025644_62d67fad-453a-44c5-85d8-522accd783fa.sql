-- Fix security warnings: Set search_path for encryption helper functions

-- Drop and recreate encrypt_refresh_token with proper search_path
DROP FUNCTION IF EXISTS public.encrypt_refresh_token(TEXT);
CREATE OR REPLACE FUNCTION public.encrypt_refresh_token(token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
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

-- Drop and recreate decrypt_refresh_token with proper search_path
DROP FUNCTION IF EXISTS public.decrypt_refresh_token(TEXT);
CREATE OR REPLACE FUNCTION public.decrypt_refresh_token(encrypted_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- Drop and recreate trigger function with proper search_path
DROP FUNCTION IF EXISTS public.handle_mail_identities_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_mail_identities_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_mail_identities_updated_at
  BEFORE UPDATE ON public.user_mail_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_mail_identities_updated_at();