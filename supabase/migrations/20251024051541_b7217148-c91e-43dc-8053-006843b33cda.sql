-- Fix encrypt_refresh_token function to properly reference pgcrypto extension
CREATE OR REPLACE FUNCTION public.encrypt_refresh_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

-- Also fix decrypt_refresh_token for consistency
CREATE OR REPLACE FUNCTION public.decrypt_refresh_token(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;